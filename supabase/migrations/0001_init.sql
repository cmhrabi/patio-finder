-- Patio Finder: initial schema
-- Apply via `supabase db push` (after `supabase link`) or paste into the SQL editor.

create extension if not exists postgis with schema extensions;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------
create table public.venues (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  description     text,
  address         text,
  neighborhood    text,
  phone           text,
  website         text,
  location        geography(Point, 4326) not null,
  price_level     smallint check (price_level between 1 and 4),
  dog_friendly    boolean not null default false,
  heated          boolean not null default false,
  covered         boolean not null default false,
  reservations    boolean not null default false,
  food            boolean not null default false,
  smoking         boolean not null default false,
  live_music      boolean not null default false,
  view            text,
  capacity        integer,
  hours           jsonb,
  attributes      jsonb not null default '{}'::jsonb,
  source          text not null default 'seed',
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index venues_location_idx on public.venues using gist (location);
create index venues_attributes_idx on public.venues using gin (attributes);

-- ---------------------------------------------------------------------------
-- patios (one venue → many patios)
-- ---------------------------------------------------------------------------
create table public.patios (
  id                uuid primary key default gen_random_uuid(),
  venue_id          uuid not null references public.venues(id) on delete cascade,
  label             text,
  area              geography(Polygon, 4326) not null,
  umbrellas         boolean not null default false,
  awning            boolean not null default false,
  retractable_roof  boolean not null default false,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index patios_venue_id_idx on public.patios (venue_id);
create index patios_area_idx on public.patios using gist (area);

-- ---------------------------------------------------------------------------
-- taps (rotating beer list)
-- ---------------------------------------------------------------------------
create table public.taps (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  beer_name   text not null,
  brewery     text,
  style       text,
  abv         numeric(3,1),
  price       numeric(6,2),
  size_ml     integer,
  tapped_at   timestamptz not null default now(),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index taps_venue_active_idx on public.taps (venue_id) where active;

-- ---------------------------------------------------------------------------
-- venue_photos (Supabase Storage paths)
-- ---------------------------------------------------------------------------
create table public.venue_photos (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues(id) on delete cascade,
  patio_id      uuid references public.patios(id) on delete set null,
  storage_path  text not null,
  caption       text,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);

create index venue_photos_venue_id_idx on public.venue_photos (venue_id, sort_order);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

create trigger patios_set_updated_at
  before update on public.patios
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: public read, writes only via service_role (bypasses RLS)
-- ---------------------------------------------------------------------------
alter table public.venues       enable row level security;
alter table public.patios       enable row level security;
alter table public.taps         enable row level security;
alter table public.venue_photos enable row level security;

create policy "venues_public_read"
  on public.venues for select
  to anon, authenticated
  using (true);

create policy "patios_public_read"
  on public.patios for select
  to anon, authenticated
  using (true);

create policy "taps_public_read"
  on public.taps for select
  to anon, authenticated
  using (true);

create policy "venue_photos_public_read"
  on public.venue_photos for select
  to anon, authenticated
  using (true);
