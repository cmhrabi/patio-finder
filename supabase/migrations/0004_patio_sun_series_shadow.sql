-- Per-timestep shadow polygon clipped to the patio.
-- Stored as GeoJSON MultiPolygon (jsonb): the client renders it directly on the
-- map, no PostGIS round-trip needed. NULL means the patio is fully sunlit at
-- that timestep; a polygon equal to the patio means fully shaded.

alter table public.patio_sun_series
  add column shadow_geojson jsonb;
