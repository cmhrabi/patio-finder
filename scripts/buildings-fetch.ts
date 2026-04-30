/**
 * One-shot OSM building fetcher.
 *
 * Reads every patio from Supabase, computes a bounding box that covers all
 * patios + ~2 km of shadow-reach buffer, queries the Overpass API for buildings
 * in that bbox, resolves heights via the OSM cascade (height → building:levels×3
 * → 6 m default), and writes the result to public/buildings.geojson in the
 * shape that loadStaticBuildings() already expects.
 *
 * Run manually with `npm run buildings:fetch`. Re-run when patios are added in
 * new neighbourhoods or roughly quarterly.
 */

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import osmtogeojson from 'osmtogeojson'
import { createSupabaseAdminClient } from '../src/lib/supabase/admin'
import { resolveHeightM } from '../src/lib/buildings/osmHeight'

// Buffer around every patio centroid. Matches the shadow-reach math used in
// snapshot.ts: HEIGHT_CAP / tan(ALT_MIN_DEG) ≈ 250 / tan(8°) ≈ 1.78 km, rounded
// up to 2 km to leave headroom for low-altitude moments.
const BUFFER_M = 2000

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

type PatioGeoRow = {
  id: string
  area_geojson: GeoJSON.Polygon | null
}

function ringCentroid(ring: number[][]): [number, number] {
  let sx = 0
  let sy = 0
  let n = 0
  const last = ring.length - 1
  const stop =
    ring.length > 1 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1]
      ? last
      : ring.length
  for (let i = 0; i < stop; i++) {
    sx += ring[i][0]
    sy += ring[i][1]
    n++
  }
  return [sx / n, sy / n]
}

function expandBboxByMetres(
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  metres: number,
): typeof bbox {
  const dLat = metres / 111_000
  const midLat = (bbox.minLat + bbox.maxLat) / 2
  const dLon = metres / (111_000 * Math.cos((midLat * Math.PI) / 180))
  return {
    minLat: bbox.minLat - dLat,
    maxLat: bbox.maxLat + dLat,
    minLon: bbox.minLon - dLon,
    maxLon: bbox.maxLon + dLon,
  }
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000
}

function roundRing(ring: number[][]): number[][] {
  return ring.map(([lon, lat]) => [round6(lon), round6(lat)])
}

function roundPolygon(rings: number[][][]): number[][][] {
  return rings.map(roundRing)
}

async function main() {
  const supabase = createSupabaseAdminClient()

  // 1. Pull patio polygons. The patios_geo view (migration 0002) already exposes
  // the geography as GeoJSON — saves us calling ST_AsGeoJSON manually.
  const { data: patios, error } = await supabase
    .from('patios_geo')
    .select('id, area_geojson')
    .returns<PatioGeoRow[]>()
  if (error) throw new Error(`patios_geo: ${error.message}`)
  if (!patios || patios.length === 0) throw new Error('No patios found in DB.')

  // 2. Compute the bbox covering every patio centroid + buffer.
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const p of patios) {
    if (!p.area_geojson || p.area_geojson.type !== 'Polygon') continue
    const [lon, lat] = ringCentroid(p.area_geojson.coordinates[0] as number[][])
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
  }
  if (!Number.isFinite(minLat)) throw new Error('No valid patio polygons found.')

  const bbox = expandBboxByMetres({ minLat, maxLat, minLon, maxLon }, BUFFER_M)
  const bboxStr = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`
  console.log(`bbox (S,W,N,E): ${bboxStr}`)

  // 3. Query Overpass. `out geom tags` inlines geometry so we don't need a
  // second pass to resolve node references. maxsize 512 MB prevents 406 rejections
  // on large bboxes.
  const query = `
    [out:json][timeout:120][maxsize:536870912];
    (
      way["building"](${bboxStr});
      relation["building"](${bboxStr});
    );
    out geom tags;
  `.trim()

  console.log('Fetching from Overpass…')
  const t0 = Date.now()
  let res: Response | undefined
  let lastErr = ''
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'patio-finder/1.0 (https://github.com/cmhrabi/patio-finder; calprice31@gmail.com)',
        },
        body: new URLSearchParams({ data: query }),
      })
      if (res.ok) break
      lastErr = `${endpoint} → ${res.status}`
      console.warn(`  ${lastErr}, trying next mirror…`)
    } catch (e) {
      lastErr = `${endpoint} → ${String(e)}`
      console.warn(`  ${lastErr}, trying next mirror…`)
    }
  }
  if (!res?.ok) {
    const body = res ? await res.text() : ''
    throw new Error(`All Overpass mirrors failed. Last: ${lastErr}\n${body.slice(0, 500)}`)
  }
  const osm = (await res.json()) as { elements: unknown[] }
  console.log(`  ${osm.elements.length} OSM elements in ${Date.now() - t0} ms`)

  // 4. Convert to GeoJSON. osmtogeojson handles multipolygon relations (outer +
  // inner ring assembly) which is the only reason we pull this dep in.
  const fc = osmtogeojson(osm) as unknown as GeoJSON.FeatureCollection

  // 5. Filter to building polygons + resolve heights into properties.heightM.
  // Output shape is { properties: { heightM }, geometry: Polygon | MultiPolygon }
  // — exactly what loadStaticBuildings() consumes.
  const out: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  }
  let dropped = 0
  for (const f of fc.features) {
    if (!f.geometry) {
      dropped++
      continue
    }
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') {
      dropped++
      continue
    }
    const tags = (f.properties ?? {}) as Record<string, string | undefined>
    if (!tags.building) {
      // osmtogeojson sometimes emits non-building features (street furniture).
      dropped++
      continue
    }
    const heightM = resolveHeightM(tags)

    // Round coordinates to 6 decimals to keep the file size reasonable.
    const geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon =
      f.geometry.type === 'Polygon'
        ? { type: 'Polygon', coordinates: roundPolygon(f.geometry.coordinates as number[][][]) }
        : {
            type: 'MultiPolygon',
            coordinates: (f.geometry.coordinates as number[][][][]).map(roundPolygon),
          }

    out.features.push({
      type: 'Feature',
      properties: { heightM },
      geometry,
    })
  }

  // 6. Write to public/buildings.geojson. loadStaticBuildings() reads this exact
  // path with the exact { properties: { heightM } } schema.
  const outPath = path.join(process.cwd(), 'public', 'buildings.geojson')
  const json = JSON.stringify(out)
  await writeFile(outPath, json, 'utf8')

  const sizeMb = (json.length / (1024 * 1024)).toFixed(2)
  console.log(`Wrote ${out.features.length} buildings (${dropped} dropped) → ${outPath}`)
  console.log(`Size: ${sizeMb} MB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
