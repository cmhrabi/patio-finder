/**
 * One-shot building fetcher (Toronto 3D Massing).
 *
 * Reads the LiDAR-derived 3D Massing dataset cached at
 * scripts/.cache/3dmassing.geojson, picks AVG_HEIGHT (or MAX_HEIGHT when
 * AVG_HEIGHT is 0), drops zero-height polygons, and writes the result to
 * public/buildings.geojson in the shape that loadStaticBuildings() expects:
 *   { properties: { heightM }, geometry: Polygon | MultiPolygon }.
 *
 * AVG_HEIGHT is preferred because it represents the bulk-occlusion height of
 * the building envelope. MAX_HEIGHT spikes on parapets, antennae, and
 * mechanical penthouses that don't meaningfully extend the shadow.
 *
 * To regenerate 3dmassing.geojson from the City of Toronto shapefile:
 *   ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
 *     -spat -79.464 43.630 -79.365 43.689 -spat_srs EPSG:4326 \
 *     -select MIN_HEIGHT,MAX_HEIGHT,AVG_HEIGHT \
 *     scripts/.cache/3dmassing.geojson \
 *     scripts/.cache/3dmassing/3DMassingShapefile_2025_WGS84.shp
 *
 * Widen the -spat box if patios are added in new neighbourhoods.
 *
 * Run manually with `npm run buildings:fetch`. Re-run when the source
 * shapefile is updated by the city (roughly annually) or when the bbox
 * needs to grow.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type MassingProps = {
  MIN_HEIGHT?: number
  MAX_HEIGHT?: number
  AVG_HEIGHT?: number
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000
}

// Strip any third (elevation) component and round to 6 decimals.
function roundRing(ring: number[][]): number[][] {
  return ring.map(([lon, lat]) => [round6(lon), round6(lat)])
}

function roundPolygon(rings: number[][][]): number[][][] {
  return rings.map(roundRing)
}

type HeightPick = {
  heightM: number
  /** Which source field we used. 'none' when no usable height was found. */
  source: 'avg' | 'max' | 'none'
  minH: number
  maxH: number
  avgH: number
}

function pickHeight(props: MassingProps | null | undefined): HeightPick {
  const minH = props?.MIN_HEIGHT ?? 0
  const maxH = props?.MAX_HEIGHT ?? 0
  const avgH = props?.AVG_HEIGHT ?? 0
  if (avgH > 0) return { heightM: avgH, source: 'avg', minH, maxH, avgH }
  if (maxH > 0) return { heightM: maxH, source: 'max', minH, maxH, avgH }
  return { heightM: 0, source: 'none', minH, maxH, avgH }
}

async function main() {
  const cachePath = path.join(process.cwd(), 'scripts', '.cache', '3dmassing.geojson')

  let raw: string
  try {
    raw = await readFile(cachePath, 'utf8')
  } catch {
    throw new Error(
      `Missing ${cachePath}.\n` +
        `Generate it from the Toronto 3D Massing shapefile:\n\n` +
        `  ogr2ogr -f GeoJSON -t_srs EPSG:4326 \\\n` +
        `    -spat -79.464 43.630 -79.365 43.689 -spat_srs EPSG:4326 \\\n` +
        `    -select MIN_HEIGHT,MAX_HEIGHT,AVG_HEIGHT \\\n` +
        `    scripts/.cache/3dmassing.geojson \\\n` +
        `    scripts/.cache/3dmassing/3DMassingShapefile_2025_WGS84.shp\n`,
    )
  }

  const fc = JSON.parse(raw) as GeoJSON.FeatureCollection
  console.log(`[massing] read ${fc.features.length} source polygons from 3dmassing.geojson`)

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
    const pick = pickHeight(f.properties as MassingProps | null)
    if (pick.heightM <= 0) {
      dropped++
      continue
    }

    const geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon =
      f.geometry.type === 'Polygon'
        ? { type: 'Polygon', coordinates: roundPolygon(f.geometry.coordinates as number[][][]) }
        : {
            type: 'MultiPolygon',
            coordinates: (f.geometry.coordinates as number[][][][]).map(roundPolygon),
          }

    out.features.push({
      type: 'Feature',
      properties: {
        heightM: round6(pick.heightM),
        heightSource: pick.source,
        minH: round6(pick.minH),
        maxH: round6(pick.maxH),
        avgH: round6(pick.avgH),
      },
      geometry,
    })
  }

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
