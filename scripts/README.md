# scripts

## buildings-fetch.ts (canonical)

Reads the City of Toronto 3D Massing dataset (LiDAR-derived building footprints with `MAX_HEIGHT` / `AVG_HEIGHT`) cached at `scripts/.cache/3dmassing.geojson` and publishes it to **Supabase Storage** as geographic tiles.

The data is no longer committed to the repo. `public/buildings.geojson` used to be a 28.7 MB file force-bundled into the Vercel workflow step function, which meant every coverage fix needed a commit and a redeploy — and each step parsed the whole city to keep ~200 polygons.

### Storage layout

```
buildings/manifest.json                         # small, cacheControl 60
buildings/<version>/tiles/<x>_<y>.geojson.gz    # immutable, cacheControl 1y
```

Tiles are a fixed 0.01° grid (~0.81 km × 1.11 km at Toronto's latitude); keys are `Math.floor(lng * 100)_Math.floor(lat * 100)`. Buildings are binned by footprint centroid — the same predicate `filterBuildingsNear` already culls on, so tiling changes no behaviour.

The manifest is uploaded **last**, so a partial upload never goes live and rollback is a manifest rewrite. Because tile paths are version-scoped they're immutable and cacheable forever.

Read back at runtime by `src/lib/buildings/loadNear.ts`. A 300 m lookup touches 1–4 tiles (~50–200 KB) instead of downloading the whole dataset, so egress stays flat as patios are added.

### Run

```bash
npm run buildings:fetch              # publish
npm run buildings:fetch -- --dry-run # tile + report, upload nothing
```

Needs `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`). Creates the `buildings` bucket if it doesn't exist. **Publishing does not require a deploy.**

### Coverage is checked, not assumed

The script reads every patio polygon from the DB, buffers their extent by 3 km, and refuses to publish if the massing cache doesn't cover it — printing the exact `ogr2ogr` command to fix it.

This check exists because the old pipeline used a hand-maintained `-spat` box. When patios were added east of it the dataset silently returned zero buildings, and the sun pipeline read "no buildings" as "no shadows" — recording three east-end patios at 94% sun with null shadow geometry. `computePatioDay` now also throws if a patio has no buildings within 300 m, so that failure can never be silent again.

### Height resolution

Per-feature `heightM` is picked from the massing properties:

1. `AVG_HEIGHT` if `> 0` — the bulk-occlusion height of the envelope
2. else `MAX_HEIGHT` if `> 0` — includes parapets / antennae / mechanical penthouses
3. else the polygon is dropped

### Regenerating the massing cache

`scripts/.cache/3dmassing.geojson` is produced from the City's shapefile via `ogr2ogr`. Run this only when `buildings:fetch` tells you to (or when the City publishes a new shapefile) — it prints the correct `-spat` for you. Tiles make extra coverage nearly free, so prefer a generous box:

```bash
ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
  -spat -79.55 43.58 -79.28 43.75 -spat_srs EPSG:4326 \
  -select MIN_HEIGHT,MAX_HEIGHT,AVG_HEIGHT \
  scripts/.cache/3dmassing.geojson \
  scripts/.cache/3dmassing/3DMassingShapefile_2025_WGS84.shp
```

That box yields ~248k buildings across ~401 tiles, ~19 MB gzipped total (~48 KB/tile).

### After publishing

New building data doesn't change `patio_sun_series` on its own. Trigger the **Sun rebuild** GitHub Action with **`mode=full`**.

`mode=missing` is *not* enough: it decides coverage by whether a patio has rows for today, so patios with existing (wrong) rows are skipped. The nightly `incremental` cron isn't enough either — it only drops yesterday and appends day 7, leaving the six middle days stale.

### Refresh cadence

Run manually:

- when the City publishes a new 3D Massing shapefile (roughly annually)
- when `buildings:fetch` fails its coverage check after patios are added

Nothing to commit — the data lives in Storage.

### Attribution

> Contains information licensed under the Open Government Licence – Toronto.

Surface this in the app footer when the dataset is in use.

## sun-rebuild.ts

Local-dev convenience: hits `/api/cron/sun-batch` with the right `Authorization: Bearer ${CRON_SECRET}` header so you can rebuild `patio_sun_series` without waiting for Vercel cron.

```bash
npm run dev          # in another terminal
npm run sun:rebuild  # ~150 s on the seed data
```

Override the URL via `SUN_BATCH_URL` if you're hitting a remote env.

## prepare-buildings.mjs (legacy)

The previous pipeline that pulled the City of Toronto 3D Massing shapefile and clipped it to a single neighbourhood. Kept for reference; superseded by `buildings-fetch.ts`, which now consumes the city-wide massing cache directly.

## generate-tokens.ts / seed.ts

Unrelated to the sun pipeline:

- `npm run tokens:gen` — regenerates `src/tokens/tokens.{css,ts}` from `tokens.json`.
- `npm run db:seed` — seeds the demo venues / patios / taps into Supabase.
