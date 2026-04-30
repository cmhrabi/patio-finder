import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type Body = {
  venue_id?: unknown
  label?: unknown
  polygon?: unknown
  umbrellas?: unknown
  awning?: unknown
  retractable_roof?: unknown
  notes?: unknown
}

const optString = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const optBool = (v: unknown) => (typeof v === 'boolean' ? v : false)

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

const isPolygon = (v: unknown): v is GeoJSON.Polygon => {
  if (!v || typeof v !== 'object') return false
  const p = v as { type?: unknown; coordinates?: unknown }
  if (p.type !== 'Polygon') return false
  if (!Array.isArray(p.coordinates) || p.coordinates.length === 0) return false
  const ring = p.coordinates[0]
  if (!Array.isArray(ring) || ring.length < 4) return false
  return ring.every(
    (pt) =>
      Array.isArray(pt) &&
      pt.length >= 2 &&
      Number.isFinite(pt[0]) &&
      Number.isFinite(pt[1]),
  )
}

function polygonToEwkt(p: GeoJSON.Polygon): string {
  const outer = p.coordinates[0] as [number, number][]
  const first = outer[0]
  const last = outer[outer.length - 1]
  const closed = first[0] === last[0] && first[1] === last[1] ? outer : [...outer, first]
  const coords = closed.map(([lng, lat]) => `${lng} ${lat}`).join(', ')
  return `SRID=4326;POLYGON((${coords}))`
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  if (!isUuid(body.venue_id)) {
    return NextResponse.json({ error: 'venue_id must be a uuid' }, { status: 400 })
  }
  if (!isPolygon(body.polygon)) {
    return NextResponse.json(
      { error: 'polygon must be a valid GeoJSON Polygon' },
      { status: 400 },
    )
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('patios')
    .insert({
      venue_id: body.venue_id,
      label: optString(body.label),
      area: polygonToEwkt(body.polygon),
      umbrellas: optBool(body.umbrellas),
      awning: optBool(body.awning),
      retractable_roof: optBool(body.retractable_roof),
      notes: optString(body.notes),
    })
    .select('id, venue_id, label')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
