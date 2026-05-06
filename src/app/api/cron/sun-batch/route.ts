import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { listVenuesFromDb } from '@/lib/patios/db'
import { loadStaticBuildings } from '@/lib/buildings/loadStatic'
import { computeSeries } from '@/lib/sun/timeSeries'

// Per-snapshot compute is ~10 ms, ~145 samples × 14 patios × 7 days ≈ 140 s.
// Hobby tier caps at 60 s — see plan note about chunking with ?day=N if needed.
export const maxDuration = 300

const TZ = 'America/Toronto'
const LOOKAHEAD_DAYS = 7
const INSERT_CHUNK = 1000

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** "YYYY-MM-DD" for the Toronto-local calendar day containing `d`. */
function torontoYmd(d: Date): string {
  return dateFmt.format(d)
}

/**
 * Build a Date at noon-ish on the given Toronto-local YYYY-MM-DD. SunCalc only
 * needs *any* timestamp inside the local day to derive sunrise/sunset; 16:00 UTC
 * is comfortably mid-day in Toronto across both EDT and EST.
 */
function noonishUtcForYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 16))
}

/** Return Toronto-local YMDs for [today, today+LOOKAHEAD_DAYS-1]. */
function lookaheadYmds(now: Date): string[] {
  const todayYmd = torontoYmd(now)
  const out: string[] = [todayYmd]
  // Walk forward by stepping 24 h from a noon-ish UTC anchor — DST transitions
  // can't break this because we re-format through the Toronto TZ each step.
  let cursor = noonishUtcForYmd(todayYmd)
  for (let i = 1; i < LOOKAHEAD_DAYS; i++) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    out.push(torontoYmd(cursor))
  }
  return out
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization')
  return header === `Bearer ${expected}`
}

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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const supabase = createSupabaseAdminClient()

  // Wipe the table before recomputing. The lookahead window is rolling, the
  // table is render-only, and storing GeoJSON polygons per timestep makes row
  // size 10–100× larger than before — a clean slate each run keeps storage
  // bounded and avoids stale rows for patios that have been removed.
  // Supabase JS requires a filter on delete; ts >= epoch matches every row.
  console.log('[sun-batch] wiping patio_sun_series…')
  const { error: wipeError } = await supabase
    .from('patio_sun_series')
    .delete()
    .gte('ts', '1970-01-01T00:00:00Z')
  if (wipeError) {
    return NextResponse.json(
      { error: `wipe failed: ${wipeError.message}` },
      { status: 500 },
    )
  }

  console.log('[sun-batch] loading patios + buildings…')
  const [venues, buildings] = await Promise.all([
    listVenuesFromDb(),
    loadStaticBuildings(),
  ])
  const patios = venues.flatMap(v => v.patios)
  console.log(`[sun-batch] ${patios.length} patios across ${venues.length} venues, ${buildings.length} buildings (${Date.now() - startedAt} ms)`)

  if (patios.length === 0) {
    return NextResponse.json({ error: 'no patios in DB' }, { status: 500 })
  }

  const now = new Date()
  const ymds = lookaheadYmds(now)

  let totalRows = 0
  for (const ymd of ymds) {
    const dayDate = noonishUtcForYmd(ymd)
    for (const patio of patios) {
      console.log(`[sun-batch] computing ${patio.id} / ${ymd}…`)
      const samples = computeSeries({
        patioId: patio.id,
        patio: patio.polygon,
        buildings,
        date: dayDate,
      })

      const rows: Row[] = samples.map(s => ({
        patio_id: patio.id,
        ts: s.time.toISOString(),
        local_date: ymd,
        minutes_from_sunrise: Math.round(s.minutesFromSunrise),
        azimuth_deg: s.azimuthDeg,
        altitude_deg: s.altitudeDeg,
        sun_fraction: Math.max(0, Math.min(1, s.sunFraction)),
        shadow_geojson: s.shadowGeoJson,
      }))

      for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        const chunk = rows.slice(i, i + INSERT_CHUNK)
        const { error } = await supabase
          .from('patio_sun_series')
          .insert(chunk)
        if (error) {
          return NextResponse.json(
            { error: `insert failed (${patio.id} / ${ymd}): ${error.message}` },
            { status: 500 },
          )
        }
      }
      totalRows += rows.length
      console.log(`[sun-batch] inserted ${rows.length} rows for ${patio.id} / ${ymd}`)
    }
  }

  return NextResponse.json({
    patios: patios.length,
    days: ymds.length,
    rows: totalRows,
    durationMs: Date.now() - startedAt,
  })
}
