/**
 * Publish the Toronto 3D Massing buildings to Supabase Storage as geographic tiles.
 *
 * Reads the LiDAR-derived 3D Massing dataset cached at
 * scripts/.cache/3dmassing.geojson, picks AVG_HEIGHT (or MAX_HEIGHT when
 * AVG_HEIGHT is 0), drops zero-height polygons, buckets what's left into a
 * 0.01° grid, and uploads one gzipped GeoJSON per cell plus a manifest.
 *
 * AVG_HEIGHT is preferred because it represents the bulk-occlusion height of
 * the building envelope. MAX_HEIGHT spikes on parapets, antennae, and
 * mechanical penthouses that don't meaningfully extend the shadow.
 *
 * Tiles are immutable under a version prefix; the manifest is written last, so
 * a partial upload never becomes live and rollback is a manifest rewrite.
 * Publishing does NOT require a deploy — the runtime loader reads Storage.
 *
 *   npm run buildings:fetch              # publish
 *   npm run buildings:fetch -- --dry-run # tile + report, upload nothing
 *
 * The script refuses to publish if the massing cache doesn't cover every patio
 * in the DB (plus a 3 km buffer) and prints the exact ogr2ogr command to fix it.
 * That check is the thing that stops coverage drifting silently, which is how
 * three east-end patios ended up with fabricated full-sun readings.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { createSupabaseAdminClient } from '../src/lib/supabase/admin'
import {
  BUILDINGS_BUCKET,
  MANIFEST_PATH,
  TILE_SIZE_DEG,
  bboxContainsBBox,
  expandBBox,
  tileKeyFor,
  tilePath,
  type BBox,
  type BuildingsManifest,
  type TileKey,
} from '../src/lib/buildings/tiles'

/** How much slack to demand around the patio extent, in metres. */
const PATIO_BUFFER_M = 3_000
/** Concurrent tile uploads. */
const UPLOAD_CONCURRENCY = 16

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

/** Mean of a ring's vertices, skipping a trailing closing duplicate. */
function ringCentroid(ring: number[][]): [number, number] {
  const last = ring.length - 1
  const closed =
    ring.length > 1 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1]
  const stop = closed ? last : ring.length
  let sx = 0
  let sy = 0
  for (let i = 0; i < stop; i++) {
    sx += ring[i][0]
    sy += ring[i][1]
  }
  return [sx / stop, sy / stop]
}

function emptyBBox(): BBox {
  return [Infinity, Infinity, -Infinity, -Infinity]
}

function growBBox(bbox: BBox, lng: number, lat: number): void {
  if (lng < bbox[0]) bbox[0] = lng
  if (lat < bbox[1]) bbox[1] = lat
  if (lng > bbox[2]) bbox[2] = lng
  if (lat > bbox[3]) bbox[3] = lat
}

/** Patio extent from the DB — what coverage has to satisfy. */
async function patioExtent(): Promise<{ bbox: BBox; count: number }> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('patios_geo')
    .select('id, area_geojson')
    .returns<Array<{ id: string; area_geojson: GeoJSON.Polygon | null }>>()
  if (error) throw new Error(`patios_geo read failed: ${error.message}`)

  const bbox = emptyBBox()
  let count = 0
  for (const row of data ?? []) {
    const poly = row.area_geojson
    if (!poly || poly.type !== 'Polygon') continue
    count++
    for (const ring of poly.coordinates) {
      for (const [lng, lat] of ring) growBBox(bbox, lng, lat)
    }
  }
  if (count === 0) throw new Error('no patios with polygons in DB')
  return { bbox, count }
}

type Tiled = {
  tiles: Map<TileKey, GeoJSON.Feature[]>
  bbox: BBox
  kept: number
  dropped: number
}

function tileFeatures(fc: GeoJSON.FeatureCollection): Tiled {
  const tiles = new Map<TileKey, GeoJSON.Feature[]>()
  const bbox = emptyBBox()
  let kept = 0
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

    // Bin by footprint centroid — the same predicate filterBuildingsNear and
    // computeSeries already cull on, so tiling changes no behaviour.
    const outer =
      geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0]
    if (!outer || outer.length < 4) {
      dropped++
      continue
    }
    const [clng, clat] = ringCentroid(outer)
    growBBox(bbox, clng, clat)

    const key = tileKeyFor(clng, clat)
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {
        heightM: round6(pick.heightM),
        heightSource: pick.source,
        minH: round6(pick.minH),
        maxH: round6(pick.maxH),
        avgH: round6(pick.avgH),
      },
      geometry,
    }
    const bucket = tiles.get(key)
    if (bucket) bucket.push(feature)
    else tiles.set(key, [feature])
    kept++
  }

  return { tiles, bbox, kept, dropped }
}

/**
 * Create the storage bucket if it isn't there yet. Idempotent, and mirrors
 * supabase/migrations/0005_buildings_bucket.sql — kept here as well so a fresh
 * environment can publish without a linked Supabase CLI.
 */
async function ensureBucket(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<void> {
  const { data, error } = await supabase.storage.getBucket(BUILDINGS_BUCKET)
  if (data && !error) {
    if (!data.public) {
      const { error: updateError } = await supabase.storage.updateBucket(BUILDINGS_BUCKET, {
        public: true,
      })
      if (updateError) throw new Error(`bucket update failed: ${updateError.message}`)
      console.log(`[massing] made bucket '${BUILDINGS_BUCKET}' public`)
    }
    return
  }
  const { error: createError } = await supabase.storage.createBucket(BUILDINGS_BUCKET, {
    public: true,
  })
  if (createError) throw new Error(`bucket create failed: ${createError.message}`)
  console.log(`[massing] created public bucket '${BUILDINGS_BUCKET}'`)
}

/** Run `worker` over `items` with bounded concurrency. */
async function mapLimit<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      await worker(items[i], i)
    }
  })
  await Promise.all(runners)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const cachePath = path.join(process.cwd(), 'scripts', '.cache', '3dmassing.geojson')

  const { bbox: patiosBBox, count: patioCount } = await patioExtent()
  const required = expandBBox(patiosBBox, PATIO_BUFFER_M)
  console.log(
    `[massing] ${patioCount} patios span [${patiosBBox.map((n) => n.toFixed(4)).join(', ')}]`,
  )

  let raw: string
  try {
    raw = await readFile(cachePath, 'utf8')
  } catch {
    throw new Error(
      `Missing ${cachePath}.\n` +
        `Generate it from the Toronto 3D Massing shapefile:\n\n` +
        ogr2ogrCommand(required),
    )
  }

  const fc = JSON.parse(raw) as GeoJSON.FeatureCollection
  console.log(`[massing] read ${fc.features.length} source polygons from 3dmassing.geojson`)

  const { tiles, bbox, kept, dropped } = tileFeatures(fc)
  console.log(`[massing] kept ${kept} buildings (${dropped} dropped) across ${tiles.size} tiles`)
  console.log(`[massing] coverage [${bbox.map((n) => n.toFixed(4)).join(', ')}]`)

  // The check that stops silent drift. Previously the -spat box was maintained
  // by hand and nothing noticed when a patio landed outside it.
  if (!bboxContainsBBox(bbox, required)) {
    throw new Error(
      `Massing cache does not cover all patios (+${PATIO_BUFFER_M / 1000} km buffer).\n` +
        `  have: [${bbox.map((n) => n.toFixed(4)).join(', ')}]\n` +
        `  need: [${required.map((n) => n.toFixed(4)).join(', ')}]\n\n` +
        `Regenerate the cache with a wider clip, then re-run this script:\n\n` +
        ogr2ogrCommand(required),
    )
  }

  const keys = [...tiles.keys()].sort()
  const bodies = new Map<TileKey, Buffer>()
  let totalGz = 0
  for (const key of keys) {
    const body = gzipSync(
      Buffer.from(
        JSON.stringify({ type: 'FeatureCollection', features: tiles.get(key)! }),
        'utf8',
      ),
      { level: 6 },
    )
    bodies.set(key, body)
    totalGz += body.length
  }

  const version = `${new Date().toISOString().replace(/[:.]/g, '-')}-${createHash('sha256')
    .update(keys.join(','))
    .update(String(kept))
    .digest('hex')
    .slice(0, 6)}`

  const manifest: BuildingsManifest = {
    version,
    tileSizeDeg: TILE_SIZE_DEG,
    bbox,
    tiles: keys,
    featureCount: kept,
    generatedAt: new Date().toISOString(),
  }

  const mb = (n: number) => (n / (1024 * 1024)).toFixed(2)
  console.log(
    `[massing] ${keys.length} tiles, ${mb(totalGz)} MB gzipped ` +
      `(avg ${Math.round(totalGz / keys.length / 1024)} KB/tile)`,
  )

  if (dryRun) {
    console.log('[massing] --dry-run: nothing uploaded')
    return
  }

  const supabase = createSupabaseAdminClient()
  await ensureBucket(supabase)

  let uploaded = 0
  await mapLimit(keys, UPLOAD_CONCURRENCY, async (key) => {
    const { error } = await supabase.storage
      .from(BUILDINGS_BUCKET)
      .upload(tilePath(version, key), bodies.get(key)!, {
        contentType: 'application/gzip',
        cacheControl: '31536000', // immutable: the path is version-scoped
        upsert: true,
      })
    if (error) throw new Error(`upload ${key} failed: ${error.message}`)
    uploaded++
    if (uploaded % 200 === 0) console.log(`[massing] uploaded ${uploaded}/${keys.length}…`)
  })
  console.log(`[massing] uploaded ${uploaded} tiles under ${version}/`)

  // Manifest last: until this lands the new tiles are invisible, so a partial
  // upload can never go live.
  const { error: manifestError } = await supabase.storage
    .from(BUILDINGS_BUCKET)
    .upload(MANIFEST_PATH, Buffer.from(JSON.stringify(manifest), 'utf8'), {
      contentType: 'application/json',
      cacheControl: '60',
      upsert: true,
    })
  if (manifestError) throw new Error(`manifest upload failed: ${manifestError.message}`)

  console.log(`[massing] published manifest → version ${version}`)
  console.log(
    `\nNext: trigger the "Sun rebuild" GitHub Action with mode=full to recompute ` +
      `patio_sun_series against the new data.`,
  )
}

function ogr2ogrCommand(bbox: BBox): string {
  const [minLng, minLat, maxLng, maxLat] = bbox.map((n) => n.toFixed(3))
  return (
    `  ogr2ogr -f GeoJSON -t_srs EPSG:4326 \\\n` +
    `    -spat ${minLng} ${minLat} ${maxLng} ${maxLat} -spat_srs EPSG:4326 \\\n` +
    `    -select MIN_HEIGHT,MAX_HEIGHT,AVG_HEIGHT \\\n` +
    `    scripts/.cache/3dmassing.geojson \\\n` +
    `    scripts/.cache/3dmassing/3DMassingShapefile_2025_WGS84.shp\n`
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
