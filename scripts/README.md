# scripts

## buildings-fetch.ts (canonical)

Reads the City of Toronto 3D Massing dataset (LiDAR-derived building footprints with `MAX_HEIGHT` / `AVG_HEIGHT`) cached at `scripts/.cache/3dmassing.geojson` and writes `public/buildings.geojson` in the shape `loadStaticBuildings()` expects.

### Run

```bash
npm run buildings:fetch
```

No network or DB access — the script only reads the local cache file and writes the public GeoJSON.

### Height resolution

Per-feature `heightM` is picked from the massing properties:

1. `MAX_HEIGHT` if `> 0`
2. else `AVG_HEIGHT` if `> 0`
3. else the polygon is dropped

### Regenerating the massing cache

`scripts/.cache/3dmassing.geojson` is produced from the City's shapefile via `ogr2ogr`. The current bbox covers the patio neighbourhoods we care about — widen `-spat` if patios are added outside it.

```bash
ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
  -spat -79.464 43.630 -79.365 43.689 -spat_srs EPSG:4326 \
  -select MIN_HEIGHT,MAX_HEIGHT,AVG_HEIGHT \
  scripts/.cache/3dmassing.geojson \
  scripts/.cache/3dmassing/3DMassingShapefile_2025_WGS84.shp
```

Then re-run `npm run buildings:fetch`.

### Refresh cadence

Run manually:

- when the City publishes a new 3D Massing shapefile (roughly annually)
- when patios are added in a neighbourhood outside the current `-spat` bbox

Commit the regenerated `public/buildings.geojson`.

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
