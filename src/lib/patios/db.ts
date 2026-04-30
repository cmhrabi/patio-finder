import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NEIGHBOURHOODS, type Neighbourhood, type Venue, type VenuePatio } from './types';

type VenueGeoRow = {
  id: string;
  name: string;
  neighborhood: string | null;
  hours: Record<string, Array<[string, string]>> | null;
  food: boolean;
  lng: number;
  lat: number;
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
 * Anything we don't recognise becomes `undefined`.
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
 * Fetch every venue with its attached patios. Drops venues that have zero
 * usable patios (no polygon ⇒ nothing to rank, nothing to render).
 */
export async function listVenuesFromDb(): Promise<Venue[]> {
  const supabase = await createSupabaseServerClient();

  const [patiosRes, venuesRes] = await Promise.all([
    supabase
      .from('patios_geo')
      .select('id, venue_id, label, area_geojson, created_at')
      .returns<PatioGeoRow[]>(),
    supabase
      .from('venues_geo')
      .select('id, name, neighborhood, hours, food, lng, lat')
      .returns<VenueGeoRow[]>(),
  ]);

  if (patiosRes.error) throw new Error(`patios_geo: ${patiosRes.error.message}`);
  if (venuesRes.error) throw new Error(`venues_geo: ${venuesRes.error.message}`);

  // Group patios by venue_id, keeping only those with a valid polygon.
  const patiosByVenue = new Map<string, VenuePatio[]>();
  for (const p of patiosRes.data ?? []) {
    const polygon = p.area_geojson;
    if (!polygon || polygon.type !== 'Polygon') continue;
    const list = patiosByVenue.get(p.venue_id);
    const entry: VenuePatio = { id: p.id, label: p.label, polygon };
    if (list) list.push(entry);
    else patiosByVenue.set(p.venue_id, [entry]);
  }

  const out: Venue[] = [];
  for (const v of venuesRes.data ?? []) {
    const patios = patiosByVenue.get(v.id);
    if (!patios || patios.length === 0) continue;
    out.push({
      id: v.id,
      name: v.name,
      lng: v.lng,
      lat: v.lat,
      hood: normaliseHood(v.neighborhood),
      openNow: isOpenNow(v.hours),
      hasOutdoorSeating: true,
      patios,
      // Use the earliest patio's createdAt as the venue's "tracked since".
      createdAt: patios[0]
        ? (patiosRes.data ?? []).find((p) => p.id === patios[0].id)?.created_at ??
          new Date().toISOString()
        : new Date().toISOString(),
    });
  }
  return out;
}
