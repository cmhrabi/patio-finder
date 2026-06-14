/**
 * Sun-batch as a Vercel Workflow. The heavy per-patio geometry (~75 s each) no
 * longer fits one function invocation, so the work fans out into one durable
 * step per patio-day. Days run sequentially; the ~14 patios within a day run in
 * parallel (bounded concurrency). The orchestrating run has no total-duration
 * cap and each step auto-retries on transient failure.
 *
 * The workflow body must stay deterministic — no `new Date()`, no DB/fs I/O.
 * Everything non-deterministic happens inside `'use step'` functions.
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { listPatiosFromDb } from '@/lib/patios/db'
import { loadStaticBuildings } from '@/lib/buildings/loadStatic'
import { filterBuildingsNear } from '@/lib/buildings/filterNear'
import { computeSeries } from '@/lib/sun/timeSeries'
import { lookaheadYmds, noonishUtcForYmd, yesterdayYmd } from '@/lib/sun/dates'

const INSERT_CHUNK = 1000

type Mode = 'full' | 'incremental'

type Row = {
  patio_id: string
  ts: string
  local_date: string
  minutes_from_sunrise: number
  azimuth_deg: number
  altitude_deg: number
  sun_fraction: number
  shadow_geojson: GeoJSON.MultiPolygon | null
}

type RunPlan = {
  mode: Mode
  /** Full mode wipes the whole table before recomputing. */
  wipe: boolean
  /** Local dates whose rows should be dropped (incremental drops yesterday). */
  deleteDates: string[]
  /** Local dates to (re)compute for every patio. */
  computeDates: string[]
  patios: Array<{ id: string; polygon: GeoJSON.Polygon }>
}

/** Mean lng/lat of a polygon's outer ring (skips a trailing closing vertex). */
function polygonCentroid(polygon: GeoJSON.Polygon): [number, number] {
  const ring = polygon.coordinates[0] as number[][]
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

/**
 * Resolve the whole run up front: date window, mode, and the patio list. Does
 * every read so the workflow body stays deterministic. Buildings are NOT loaded
 * here — each compute step loads + filters its own subset to keep this step's
 * output payload small.
 */
async function planRun(mode: Mode): Promise<RunPlan> {
  'use step'
  const supabase = createSupabaseAdminClient()
  const now = new Date()
  const ymds = lookaheadYmds(now)

  let full = mode === 'full'
  if (!full) {
    // If the table doesn't already cover today, the window is empty or stale
    // (fresh deploy, post-wipe, rolled past) and an incremental run would leave
    // gaps. Promote to a full rebuild instead.
    const { count, error } = await supabase
      .from('patio_sun_series')
      .select('*', { count: 'exact', head: true })
      .eq('local_date', ymds[0])
    if (error) throw new Error(`window check failed: ${error.message}`)
    if (!count) {
      console.log('[sun-batch] table missing today — promoting to full rebuild')
      full = true
    }
  }

  const patios = await listPatiosFromDb(supabase)
  if (patios.length === 0) throw new Error('no patios in DB')

  if (full) {
    return { mode: 'full', wipe: true, deleteDates: [], computeDates: ymds, patios }
  }
  // Incremental: drop yesterday, append only the new 7th day. The 6 middle days
  // carry over — shadow geometry for a calendar date is deterministic.
  return {
    mode: 'incremental',
    wipe: false,
    deleteDates: [yesterdayYmd(now)],
    computeDates: [ymds[ymds.length - 1]],
    patios,
  }
}

/** Full-mode wipe. Supabase JS needs a filter on delete; ts >= epoch matches all. */
async function wipeAllRows(): Promise<void> {
  'use step'
  console.log('[sun-batch] full rebuild — wiping patio_sun_series…')
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from('patio_sun_series')
    .delete()
    .gte('ts', '1970-01-01T00:00:00Z')
  if (error) throw new Error(`wipe failed: ${error.message}`)
}

/** Drop every row for one local date (the incremental "drop yesterday"). */
async function deleteLocalDate(ymd: string): Promise<void> {
  'use step'
  console.log(`[sun-batch] deleting ${ymd}…`)
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('patio_sun_series').delete().eq('local_date', ymd)
  if (error) throw new Error(`delete ${ymd} failed: ${error.message}`)
}

/**
 * Compute one patio's series for one local date and write it. Idempotent so the
 * SDK's auto-retry is safe: it deletes this patio-day's existing rows (PK is
 * `(patio_id, ts)`, so a blind re-insert would conflict) before inserting.
 * Returns the row count; the shadow GeoJSON goes straight to Supabase and never
 * passes back through workflow persistence.
 */
async function computePatioDay(
  patioId: string,
  polygon: GeoJSON.Polygon,
  ymd: string,
): Promise<number> {
  'use step'
  const supabase = createSupabaseAdminClient()
  const allBuildings = await loadStaticBuildings()
  const buildings = filterBuildingsNear(allBuildings, polygonCentroid(polygon))

  const samples = computeSeries({
    patioId,
    patio: polygon,
    buildings,
    date: noonishUtcForYmd(ymd),
  })

  const rows: Row[] = samples.map(s => ({
    patio_id: patioId,
    ts: s.time.toISOString(),
    local_date: ymd,
    minutes_from_sunrise: Math.round(s.minutesFromSunrise),
    azimuth_deg: s.azimuthDeg,
    altitude_deg: s.altitudeDeg,
    sun_fraction: Math.max(0, Math.min(1, s.sunFraction)),
    shadow_geojson: s.shadowGeoJson,
  }))

  // Idempotent: clear this patio-day first so a retry can't hit a PK conflict.
  const { error: delError } = await supabase
    .from('patio_sun_series')
    .delete()
    .eq('patio_id', patioId)
    .eq('local_date', ymd)
  if (delError) throw new Error(`clear failed (${patioId} / ${ymd}): ${delError.message}`)

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK)
    const { error } = await supabase.from('patio_sun_series').insert(chunk)
    if (error) throw new Error(`insert failed (${patioId} / ${ymd}): ${error.message}`)
  }
  console.log(`[sun-batch] inserted ${rows.length} rows for ${patioId} / ${ymd}`)
  return rows.length
}

/**
 * Orchestrate a full or incremental rebuild. Deterministic: it only branches on
 * the plan returned by `planRun` and fans out compute steps day-by-day.
 */
export async function sunBatchWorkflow(input: { mode: Mode }): Promise<{
  mode: Mode
  days: string[]
  patios: number
  rows: number
}> {
  'use workflow'
  const plan = await planRun(input.mode)

  if (plan.wipe) await wipeAllRows()
  for (const ymd of plan.deleteDates) await deleteLocalDate(ymd)

  let rows = 0
  for (const ymd of plan.computeDates) {
    // Days are sequential; patios within a day run in parallel (~14 at once).
    const counts = await Promise.all(
      plan.patios.map(p => computePatioDay(p.id, p.polygon, ymd)),
    )
    for (const c of counts) rows += c
  }

  return { mode: plan.mode, days: plan.computeDates, patios: plan.patios.length, rows }
}
