import { createSupabaseAdminClient } from '../src/lib/supabase/admin'

type Coord = [number, number] // [lng, lat]

const ewktPoint = ([lng, lat]: Coord) => `SRID=4326;POINT(${lng} ${lat})`

const ewktPolygon = (ring: Coord[]) => {
  const last = ring[ring.length - 1]
  const closed =
    ring[0][0] === last[0] && ring[0][1] === last[1] ? ring : [...ring, ring[0]]
  return `SRID=4326;POLYGON((${closed.map(([lng, lat]) => `${lng} ${lat}`).join(', ')}))`
}

type PatioSeed = {
  label?: string
  area: Coord[]
  umbrellas?: boolean
  awning?: boolean
  retractable_roof?: boolean
  notes?: string
}

type TapSeed = {
  beer_name: string
  brewery?: string
  style?: string
  abv?: number
  size_ml?: number
  price?: number
}

type VenueSeed = {
  slug: string
  name: string
  description?: string
  address: string
  neighborhood?: string
  website?: string
  location: Coord
  price_level?: number
  dog_friendly?: boolean
  heated?: boolean
  covered?: boolean
  reservations?: boolean
  food?: boolean
  smoking?: boolean
  live_music?: boolean
  capacity?: number
  hours?: Record<string, [string, string][]>
  patios: PatioSeed[]
  taps: TapSeed[]
}

const venues: VenueSeed[] = [
  {
    slug: 'bellwoods-ossington',
    name: 'Bellwoods Brewery (Ossington)',
    description:
      'Original Bellwoods taproom and bottle shop with a sun-drenched front patio.',
    address: '124 Ossington Ave, Toronto, ON',
    neighborhood: 'Trinity-Bellwoods',
    website: 'https://bellwoodsbrewery.com',
    location: [-79.4218, 43.6481],
    price_level: 3,
    dog_friendly: true,
    food: true,
    capacity: 60,
    hours: {
      mon: [['12:00', '22:00']],
      tue: [['12:00', '22:00']],
      wed: [['12:00', '22:00']],
      thu: [['12:00', '23:00']],
      fri: [['12:00', '24:00']],
      sat: [['11:00', '24:00']],
      sun: [['11:00', '22:00']],
    },
    patios: [
      {
        label: 'Front patio',
        area: [
          [-79.42199, 43.64803],
          [-79.42161, 43.64803],
          [-79.42161, 43.64817],
          [-79.42199, 43.64817],
        ],
        umbrellas: true,
        notes: 'Faces west — afternoon sun, evening shade from buildings.',
      },
    ],
    taps: [
      { beer_name: 'Jutsu', brewery: 'Bellwoods', style: 'NEIPA', abv: 6.4, size_ml: 473 },
      { beer_name: 'Witchshark', brewery: 'Bellwoods', style: 'DIPA', abv: 9.0, size_ml: 355 },
      { beer_name: 'Roman Candle', brewery: 'Bellwoods', style: 'IPA', abv: 6.8, size_ml: 473 },
    ],
  },
  {
    slug: 'left-field-brewery',
    name: 'Left Field Brewery',
    description: 'Baseball-themed Leslieville brewery with a generous back patio.',
    address: '36 Wagstaff Dr, Toronto, ON',
    neighborhood: 'Leslieville',
    website: 'https://leftfieldbrewery.ca',
    location: [-79.329, 43.6766],
    price_level: 2,
    dog_friendly: true,
    heated: true,
    covered: true,
    food: true,
    capacity: 80,
    hours: {
      mon: [['12:00', '22:00']],
      tue: [['12:00', '22:00']],
      wed: [['12:00', '22:00']],
      thu: [['12:00', '23:00']],
      fri: [['12:00', '24:00']],
      sat: [['11:00', '24:00']],
      sun: [['11:00', '22:00']],
    },
    patios: [
      {
        label: 'Back patio',
        area: [
          [-79.32918, 43.67654],
          [-79.32882, 43.67654],
          [-79.32882, 43.67668],
          [-79.32918, 43.67668],
        ],
        umbrellas: true,
        awning: true,
        notes: 'South-facing, gets direct sun mid-afternoon onward.',
      },
    ],
    taps: [
      { beer_name: 'Eephus', brewery: 'Left Field', style: 'Oatmeal Brown', abv: 5.5, size_ml: 473 },
      { beer_name: 'Maris*', brewery: 'Left Field', style: 'Pale Ale', abv: 4.8, size_ml: 473 },
    ],
  },
]

async function main() {
  const supabase = createSupabaseAdminClient()

  for (const v of venues) {
    const { patios, taps, location, ...venueRow } = v

    const { data: venue, error: venueErr } = await supabase
      .from('venues')
      .upsert(
        { ...venueRow, location: ewktPoint(location), source: 'seed' },
        { onConflict: 'slug' },
      )
      .select('id, name')
      .single()

    if (venueErr || !venue) {
      throw new Error(`upsert venues[${v.slug}]: ${venueErr?.message}`)
    }
    console.log(`venue: ${venue.name}`)

    // Replace patios + taps for idempotent re-runs
    const { error: pDelErr } = await supabase.from('patios').delete().eq('venue_id', venue.id)
    if (pDelErr) throw new Error(`delete patios[${v.slug}]: ${pDelErr.message}`)

    if (patios.length) {
      const { error: pErr } = await supabase.from('patios').insert(
        patios.map((p) => ({
          venue_id: venue.id,
          label: p.label,
          area: ewktPolygon(p.area),
          umbrellas: p.umbrellas ?? false,
          awning: p.awning ?? false,
          retractable_roof: p.retractable_roof ?? false,
          notes: p.notes,
        })),
      )
      if (pErr) throw new Error(`insert patios[${v.slug}]: ${pErr.message}`)
    }
    console.log(`  patios: ${patios.length}`)

    const { error: tDelErr } = await supabase.from('taps').delete().eq('venue_id', venue.id)
    if (tDelErr) throw new Error(`delete taps[${v.slug}]: ${tDelErr.message}`)

    if (taps.length) {
      const { error: tErr } = await supabase
        .from('taps')
        .insert(taps.map((t) => ({ ...t, venue_id: venue.id })))
      if (tErr) throw new Error(`insert taps[${v.slug}]: ${tErr.message}`)
    }
    console.log(`  taps:   ${taps.length}`)
  }

  console.log('\nseed complete')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
