-- Precomputed sun-coverage time series per patio.
-- Populated by the nightly /api/cron/sun-batch route (today + 6 days, 5-min steps).
-- The UI reads directly from this table — no on-the-fly compute.
set local search_path = public, extensions;
create table public.patio_sun_series (
  patio_id              uuid not null references public.patios(id) on delete cascade,
  ts                    timestamptz not null,
  local_date            date not null,
  minutes_from_sunrise  integer not null,
  azimuth_deg           real not null,
  altitude_deg          real not null,
  sun_fraction          real not null check (sun_fraction between 0 and 1),
  computed_at           timestamptz not null default now(),
  primary key (patio_id, ts)
);

create index patio_sun_series_local_date_idx
  on public.patio_sun_series (local_date, patio_id);

alter table public.patio_sun_series enable row level security;

create policy "patio_sun_series_public_read"
  on public.patio_sun_series for select
  to anon, authenticated
  using (true);
