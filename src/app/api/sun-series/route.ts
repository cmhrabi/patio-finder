import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_OFFSET_DAYS = 31

type SeriesRow = {
  patio_id: string
  ts: string
  minutes_from_sunrise: number
  azimuth_deg: number
  altitude_deg: number
  sun_fraction: number
  shadow_geojson: GeoJSON.MultiPolygon | null
}

/** Wire type for a single sample. Time is an ISO string; client should re-parse. */
export type WireSunSample = {
  time: string
  minutesFromSunrise: number
  azimuthDeg: number
  altitudeDeg: number
  sunFraction: number
  shadowGeoJson: GeoJSON.MultiPolygon | null
}

export type SunSeriesResponse = {
  date: string
  byPatioId: Record<string, WireSunSample[]>
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const date = params.get('date')
  if (!date || !YMD_RE.test(date)) {
    return NextResponse.json({ error: 'date=YYYY-MM-DD required' }, { status: 400 })
  }

  // Sanity-check the date isn't wildly out of range. Stops us from running
  // arbitrary range scans on the table.
  const reqMs = Date.parse(`${date}T12:00:00Z`)
  if (!Number.isFinite(reqMs)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }
  const offsetDays = Math.abs(Date.now() - reqMs) / (24 * 60 * 60 * 1000)
  if (offsetDays > MAX_OFFSET_DAYS) {
    return NextResponse.json({ error: 'date out of range' }, { status: 400 })
  }

  const fromTs = params.get('fromTs')
  const toTs = params.get('toTs')
  const patioId = params.get('patioId')

  if (fromTs !== null && !Number.isFinite(Date.parse(fromTs))) {
    return NextResponse.json({ error: 'invalid fromTs' }, { status: 400 })
  }
  if (toTs !== null && !Number.isFinite(Date.parse(toTs))) {
    return NextResponse.json({ error: 'invalid toTs' }, { status: 400 })
  }
  if (fromTs !== null && toTs !== null && Date.parse(fromTs) > Date.parse(toTs)) {
    return NextResponse.json({ error: 'fromTs must be <= toTs' }, { status: 400 })
  }
  if (patioId !== null && !UUID_RE.test(patioId)) {
    return NextResponse.json({ error: 'invalid patioId' }, { status: 400 })
  }

  // Force callers to slice the request. Returning the full day across every
  // patio in one shot is what hit PostgREST's row cap and clipped the chart at
  // ~3pm; making the contract explicit prevents that regression.
  const hasWindow = fromTs !== null && toTs !== null
  if (!hasWindow && !patioId) {
    return NextResponse.json(
      { error: 'specify a time window (fromTs+toTs) or patioId' },
      { status: 400 },
    )
  }

  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from('patio_sun_series')
    .select('patio_id, ts, minutes_from_sunrise, azimuth_deg, altitude_deg, sun_fraction, shadow_geojson')
    .eq('local_date', date)
    .order('ts', { ascending: true })

  if (fromTs !== null) query = query.gte('ts', fromTs)
  if (toTs !== null) query = query.lte('ts', toTs)
  if (patioId !== null) query = query.eq('patio_id', patioId)

  const { data, error } = await query.returns<SeriesRow[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const byPatioId: Record<string, WireSunSample[]> = {}
  for (const r of data ?? []) {
    const sample: WireSunSample = {
      time: r.ts,
      minutesFromSunrise: r.minutes_from_sunrise,
      azimuthDeg: r.azimuth_deg,
      altitudeDeg: r.altitude_deg,
      sunFraction: r.sun_fraction,
      shadowGeoJson: r.shadow_geojson,
    }
    ;(byPatioId[r.patio_id] ??= []).push(sample)
  }

  const body: SunSeriesResponse = { date, byPatioId }
  return NextResponse.json(body, {
    headers: {
      // Series for a given date is immutable post-batch; cache hard at the edge.
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
