/**
 * One-shot OSM building fetcher.
 *
 * Reads every patio from Supabase, computes a bounding box that covers all
 * patios + ~2 km of shadow-reach buffer, queries the Overpass API for buildings
 * in that bbox, resolves heights via the OSM cascade (height → building:levels×3
 * → 6 m default), and writes the result to public/buildings.geojson in the
 * shape that loadStaticBuildings() already expects.
 *
 * When OSM falls back to the 6 m default, the script performs a spatial join
 * against the Toronto 3D Massing dataset (scripts/.cache/3dmassing.geojson,
 * converted from the city-wide shapefile via ogr2ogr) and substitutes the
 * LiDAR-derived MAX_HEIGHT where available.
 *
 * To regenerate 3dmassing.geojson from the shapefile:
 *   ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
 *     -spat -79.464 43.630 -79.365 43.689 -spat_srs EPSG:4326 \
 *     -select MIN_HEIGHT,MAX_HEIGHT,AVG_HEIGHT \
 *     scripts/.cache/3dmassing.geojson \
 *     scripts/.cache/3dmassing/3DMassingShapefile_2025_WGS84.shp
 *
 * Run manually with `npm run buildings:fetch`. Re-run when patios are added in
 * new neighbourhoods or roughly quarterly.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import osmtogeojson from 'osmtogeojson'
import { createSupabaseAdminClient } from '../src/lib/supabase/admin'
import { resolveHeightM, FALLBACK_HEIGHT_M } from '../src/lib/buildings/osmHeight'

// ---------------------------------------------------------------------------
// Toronto 3D Massing spatial index
// ---------------------------------------------------------------------------

type MassingFeature = {
  rings: number[][][] // outer ring + optional holes; coordinates are [lon, lat]
  maxHeight: number
  bbox: [number, number, number, number] // minLon, minLat, maxLon, maxLat
}

type MassingIndex = {
  features: MassingFeature[]
  // Grid index: cell key → indices into features[]
  grid: Map<string, number[]>
  cellSize: number
}

function massingBbox(rings: number[][][]): [number, number, number, number] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  for (const coord of rings[0]) {
    if (coord[0] < minLon) minLon = coord[0]
    if (coord[0] > maxLon) maxLon = coord[0]
    if (coord[1] < minLat) minLat = coord[1]
    if (coord[1] > maxLat) maxLat = coord[1]
  }
  return [minLon, minLat, maxLon, maxLat]
}

function gridKey(col: number, row: number): string {
  return `${col},${row}`
}

function buildMassingIndex(features: MassingFeature[], cellSize = 0.002): MassingIndex {
  const grid = new Map<string, number[]>()
  for (let i = 0; i < features.length; i++) {
    const [minLon, minLat, maxLon, maxLat] = features[i].bbox
    const c0 = Math.floor(minLon / cellSize)
    const c1 = Math.floor(maxLon / cellSize)
    const r0 = Math.floor(minLat / cellSize)
    const r1 = Math.floor(maxLat / cellSize)
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const k = gridKey(c, r)
        const bucket = grid.get(k)
        if (bucket) bucket.push(i)
        else grid.set(k, [i])
      }
    }
  }
  return { features, grid, cellSize }
}

// Ray-casting point-in-polygon for a single ring.
function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function pointInMassingPolygon(lon: number, lat: number, f: MassingFeature): boolean {
  if (!pointInRing(lon, lat, f.rings[0])) return false
  // Subtract holes
  for (let h = 1; h < f.rings.length; h++) {
    if (pointInRing(lon, lat, f.rings[h])) return false
  }
  return true
}

/** Return the MAX_HEIGHT of the first massing polygon that contains [lon, lat]. */
function lookupMassingHeight(index: MassingIndex, lon: number, lat: number): number | null {
  const { grid, features, cellSize } = index
  const c = Math.floor(lon / cellSize)
  const r = Math.floor(lat / cellSize)
  const candidates = grid.get(gridKey(c, r))
  if (!candidates) return null
  for (const i of candidates) {
    const f = features[i]
    if (lon < f.bbox[0] || lon > f.bbox[2] || lat < f.bbox[1] || lat > f.bbox[3]) continue
    if (pointInMassingPolygon(lon, lat, f)) return f.maxHeight
  }
  return null
}

async function loadMassingIndex(): Promise<MassingIndex | null> {
  const cachePath = path.join(process.cwd(), 'scripts', '.cache', '3dmassing.geojson')
  let raw: string
  try {
    raw = await readFile(cachePath, 'utf8')
  } catch {
    console.warn('[massing] scripts/.cache/3dmassing.geojson not found — skipping height enrichment')
    return null
  }
  const fc = JSON.parse(raw) as GeoJSON.FeatureCollection
  const features: MassingFeature[] = []
  for (const feat of fc.features) {
    const maxHeight = (feat.properties as Record<string, number> | null)?.MAX_HEIGHT ?? 0
    if (!(maxHeight > 0)) continue
    if (feat.geometry.type === 'Polygon') {
      const rings = feat.geometry.coordinates as number[][][]
      features.push({ rings, maxHeight, bbox: massingBbox(rings) })
    } else if (feat.geometry.type === 'MultiPolygon') {
      for (const poly of feat.geometry.coordinates as number[][][][]) {
        features.push({ rings: poly, maxHeight, bbox: massingBbox(poly) })
      }
    }
  }
  console.log(`[massing] loaded ${features.length} polygons from 3dmassing.geojson`)
  return buildMassingIndex(features)
}

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

  // 0. Load Toronto 3D Massing index for height enrichment (best-effort).
  const massingIndex = await loadMassingIndex()

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
  let massingHits = 0
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
    let heightM = resolveHeightM(tags)

    // When OSM had no height data, try the Toronto 3D Massing dataset.
    if (heightM === FALLBACK_HEIGHT_M && massingIndex) {
      const outerRing =
        f.geometry.type === 'Polygon'
          ? (f.geometry.coordinates as number[][][])[0]
          : (f.geometry.coordinates as number[][][][])[0][0]
      const [lon, lat] = ringCentroid(outerRing)
      const massingH = lookupMassingHeight(massingIndex, lon, lat)
      if (massingH !== null) {
        heightM = massingH
        massingHits++
      }
    }

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
  if (massingIndex) console.log(`Massing enrichment: ${massingHits} / ${out.features.length} buildings updated from fallback`)
  console.log(`Size: ${sizeMb} MB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
