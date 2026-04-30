# scripts

## buildings-fetch.ts (canonical)

Pulls building footprints + heights from OpenStreetMap (via the Overpass API) for the bounding box that covers every patio in the DB plus a ~2 km shadow-reach buffer, and writes the result to `public/buildings.geojson` in the shape `loadStaticBuildings()` expects.

### Run

```bash
npm run buildings:fetch
```

Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` (the script reads patios from Supabase to derive the bbox).

### Height resolution

Per-feature `heightM` is filled with the cascade — see `src/lib/buildings/osmHeight.ts`:

1. `tags.height` (or `tags['building:height']`), parsed as metres
2. `tags['building:levels'] × 3 m`
3. **6 m default** (≈ 2 storeys)

The default kicks in for any building with neither tag — common for low-rise residential. It's deliberately conservative; if you see a tall building treated as 6 m, tag it on OSM and re-run.

### Refresh cadence

Run manually:

- when patios are added in a new neighbourhood (so the bbox covers the new area)
- roughly quarterly to pick up OSM contributions
- after any complaint that "this patio's sun coverage looks wrong"

Commit the regenerated `public/buildings.geojson`.

### Attribution

> © OpenStreetMap contributors

Surface this in the app footer when the dataset is in use.

## sun-rebuild.ts

Local-dev convenience: hits `/api/cron/sun-batch` with the right `Authorization: Bearer ${CRON_SECRET}` header so you can rebuild `patio_sun_series` without waiting for Vercel cron.

```bash
npm run dev          # in another terminal
npm run sun:rebuild  # ~150 s on the seed data
```

Override the URL via `SUN_BATCH_URL` if you're hitting a remote env.

## prepare-buildings.mjs (legacy)

The previous pipeline that pulled the City of Toronto 3D Massing shapefile and clipped it to a single neighbourhood. Kept for reference; superseded by `buildings-fetch.ts`, which uses OSM and covers all patios in one pass. Don't run unless you specifically want Massing data.

## generate-tokens.ts / seed.ts

Unrelated to the sun pipeline:

- `npm run tokens:gen` — regenerates `src/tokens/tokens.{css,ts}` from `tokens.json`.
- `npm run db:seed` — seeds the demo venues / patios / taps into Supabase.
