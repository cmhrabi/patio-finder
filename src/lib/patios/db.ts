import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NEIGHBOURHOODS, type Neighbourhood, type Patio } from './types';

type VenueGeoRow = {
  id: string;
  name: string;
  neighborhood: string | null;
  hours: Record<string, Array<[string, string]>> | null;
  food: boolean;
};

type PatioGeoRow = {
  id: string;
  venue_id: string;
  label: string | null;
  area_geojson: GeoJSON.Polygon | null;
  created_at: string;
};

const TZ = 'America/Toronto';

/**
 * Map a free-form DB `neighborhood` string to one of the canonical 8 the filter UI
 * knows about. Hyphens are folded to spaces and casing is ignored, so DB values like
 * `"Trinity-Bellwoods"` or `"trinity bellwoods"` both resolve to `"Trinity Bellwoods"`.
 * Anything we don't recognise becomes `undefined` (the patio still appears, just
 * without a hood pill, and won't be matched by the neighbourhood filter).
 */
function normaliseHood(raw: string | null | undefined): Neighbourhood | undefined {
  if (!raw) return undefined;
  const cleaned = raw.toLowerCase().replace(/[\s-]+/g, ' ').trim();
  return NEIGHBOURHOODS.find((n) => n.toLowerCase() === cleaned);
}

/**
 * Derive `openNow` from the venue's `hours` jsonb (shape: `{ mon: [["12:00","22:00"], ...] }`).
 * Returns `undefined` when hours are missing so callers can distinguish "no data" from "closed".
 */
function isOpenNow(hours: Record<string, Array<[string, string]>> | null): boolean | undefined {
  if (!hours) return undefined;
  const now = new Date();
  const dayKey = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  })
    .format(now)
    .toLowerCase();
  const slots = hours[dayKey];
  if (!slots || slots.length === 0) return false;
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  return slots.some(([start, end]) => timeStr >= start && timeStr < end);
}

/**
 * List every patio in the DB, joined with its venue, mapped to the shape the
 * landing + map UI expects. Public read RLS lets this run with the publishable
 * key — no service role needed.
 */
export async function listPatiosFromDb(): Promise<Patio[]> {
  const supabase = await createSupabaseServerClient();

  const [patiosRes, venuesRes] = await Promise.all([
    supabase
      .from('patios_geo')
      .select('id, venue_id, label, area_geojson, created_at')
      .returns<PatioGeoRow[]>(),
    supabase
      .from('venues_geo')
      .select('id, name, neighborhood, hours, food')
      .returns<VenueGeoRow[]>(),
  ]);

  if (patiosRes.error) throw new Error(`patios_geo: ${patiosRes.error.message}`);
  if (venuesRes.error) throw new Error(`venues_geo: ${venuesRes.error.message}`);

  const venuesById = new Map((venuesRes.data ?? []).map((v) => [v.id, v]));

  const out: Patio[] = [];
  for (const p of patiosRes.data ?? []) {
    const venue = venuesById.get(p.venue_id);
    if (!venue) continue;
    const polygon = p.area_geojson;
    if (!polygon || polygon.type !== 'Polygon') continue;
    out.push({
      id: p.id,
      name: venue.name,
      polygon,
      createdAt: p.created_at,
      hood: normaliseHood(venue.neighborhood),
      openNow: isOpenNow(venue.hours),
      // Patios in the DB are outdoor seating areas by definition.
      hasOutdoorSeating: true,
    });
  }
  return out;
}
