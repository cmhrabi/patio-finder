-- Geo helper views: expose PostGIS geometry as plain numbers / GeoJSON
-- so the frontend can render points and polygons without RPC plumbing.
--
-- security_invoker=on => RLS on the underlying tables is still enforced
-- (otherwise the view would run as its owner, bypassing RLS).
set local search_path = public, extensions;

create or replace view public.venues_geo
  with (security_invoker = on) as
select
  v.id,
  v.slug,
  v.name,
  v.description,
  v.address,
  v.neighborhood,
  v.phone,
  v.website,
  v.price_level,
  v.dog_friendly,
  v.heated,
  v.covered,
  v.reservations,
  v.food,
  v.smoking,
  v.live_music,
  v.view,
  v.capacity,
  v.hours,
  v.attributes,
  v.source,
  v.created_at,
  v.updated_at,
  st_x(v.location::geometry) as lng,
  st_y(v.location::geometry) as lat
from public.venues v;

create or replace view public.patios_geo
  with (security_invoker = on) as
select
  p.id,
  p.venue_id,
  p.label,
  p.umbrellas,
  p.awning,
  p.retractable_roof,
  p.notes,
  p.created_at,
  p.updated_at,
  st_asgeojson(p.area)::json as area_geojson
from public.patios p;

grant select on public.venues_geo to anon, authenticated;
grant select on public.patios_geo to anon, authenticated;
