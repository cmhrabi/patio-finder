import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type Body = {
  name?: unknown
  address?: unknown
  neighborhood?: unknown
  website?: unknown
  phone?: unknown
  description?: unknown
  lng?: unknown
  lat?: unknown
  dog_friendly?: unknown
  heated?: unknown
  covered?: unknown
  reservations?: unknown
  food?: unknown
  smoking?: unknown
  live_music?: unknown
  capacity?: unknown
  price_level?: unknown
  view?: unknown
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'venue'

const randSuffix = () => Math.random().toString(36).slice(2, 6)

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const optString = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const optBool = (v: unknown) => (typeof v === 'boolean' ? v : false)
const optInt = (v: unknown) => (isFiniteNum(v) ? Math.trunc(v) : null)

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const name = optString(body.name)
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  if (!isFiniteNum(body.lng) || !isFiniteNum(body.lat)) {
    return NextResponse.json({ error: 'lng and lat are required numbers' }, { status: 400 })
  }
  if (body.lng < -180 || body.lng > 180 || body.lat < -90 || body.lat > 90) {
    return NextResponse.json({ error: 'lng/lat out of range' }, { status: 400 })
  }

  const priceLevel = optInt(body.price_level)
  if (priceLevel != null && (priceLevel < 1 || priceLevel > 4)) {
    return NextResponse.json({ error: 'price_level must be 1–4' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const base = slugify(name)

  // Try base slug, fall back to suffixed slug on unique violation.
  for (const slug of [base, `${base}-${randSuffix()}`]) {
    const { data, error } = await supabase
      .from('venues')
      .insert({
        slug,
        name,
        description: optString(body.description),
        address: optString(body.address),
        neighborhood: optString(body.neighborhood),
        website: optString(body.website),
        phone: optString(body.phone),
        location: `SRID=4326;POINT(${body.lng} ${body.lat})`,
        dog_friendly: optBool(body.dog_friendly),
        heated: optBool(body.heated),
        covered: optBool(body.covered),
        reservations: optBool(body.reservations),
        food: optBool(body.food),
        smoking: optBool(body.smoking),
        live_music: optBool(body.live_music),
        capacity: optInt(body.capacity),
        price_level: priceLevel,
        view: optString(body.view),
        source: 'crowdsourced',
      })
      .select('id, slug, name')
      .single()

    if (!error && data) return NextResponse.json(data, { status: 201 })
    // 23505 = unique_violation — retry with suffix
    if (error?.code !== '23505') {
      return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'slug collision' }, { status: 409 })
}
