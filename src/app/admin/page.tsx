import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import AdminWorkspace, { type VenueGeo, type PatioGeo } from './AdminWorkspace'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()

  // Re-verify here too — the Proxy gate is optimistic, not authoritative.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const [venuesRes, patiosRes] = await Promise.all([
    supabase.from('venues_geo').select('id, slug, name, lng, lat'),
    supabase.from('patios_geo').select('id, venue_id, label, area_geojson'),
  ])

  const venues = (venuesRes.data ?? []) as VenueGeo[]
  const patios = (patiosRes.data ?? []) as PatioGeo[]

  return (
    <main className="h-screen w-screen">
      <AdminWorkspace initialVenues={venues} initialPatios={patios} />
    </main>
  )
}
