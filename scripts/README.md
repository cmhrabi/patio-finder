# scripts

## prepare-buildings.mjs

One-shot data prep for `public/buildings.geojson`. Clips the City of Toronto 3D Massing dataset to a circular area around a chosen centre, simplifies, and derives a per-feature `heightM` field for the `fill-extrusion` layer and the sun-fraction polygon math.

### Defaults

Centre: `(-79.4275, 43.6535)` — Ladybug Tavern / College & Dovercourt area.
Radius: 800 m. Simplify tolerance: ~0.5 m (in degrees at Toronto's latitude).

### Run

```bash
node scripts/prepare-buildings.mjs
# or override
node scripts/prepare-buildings.mjs --lon -79.43 --lat 43.65 --radius 1000 --out public/buildings.geojson
```

### Requirements

- Node ≥ 18 (`scripts/.cache/` will be created)
- `ogr2ogr` (GDAL) on `PATH`
- `unzip` on `PATH`
- ~100 MB free disk for the cached source data

### Pipeline

1. Downloads `3dmassingshapefile_2025_wgs84.zip` from open.toronto.ca into `scripts/.cache/3dmassing.zip` (cached on subsequent runs).
2. Unzips into `scripts/.cache/3dmassing/`.
3. Runs `ogr2ogr` with `-clipsrc <bbox>` (computed from `--lon/--lat/--radius`) and `-simplify` to produce a small GeoJSON.
4. Post-processes in Node: keeps only polygon features, derives `heightM`, drops every other property.

### Height (the EleZ caveat)

The 3D Massing shapefile reports `EleZ` as **orthometric elevation in metres above sea level** for the rooftop, not building height above ground. The script picks one of these strategies depending on the fields present in the shipped vintage:

1. `AVG_HT_M` — explicit average building height, preferred when present.
2. `MAX_HT_M` — explicit maximum building height.
3. `EleZ - ground_z` — when both fields are present.
4. `EleZ - localGroundEleZ` — fallback. `localGroundEleZ` is the 5th-percentile `EleZ` across all clipped features, used as a coarse ground-level proxy. Adequate on the (flat) Toronto plain at the scale of one neighbourhood; will be wrong near steep slopes.

In all cases `heightM` is clamped to `[3, 300]` metres.

**Always cross-check a few buildings against shademap.app or street-level photos before trusting the shadow output for a new neighbourhood.**

### Attribution

> Contains information licensed under the Open Government Licence – Toronto.

This must appear somewhere in the running app (footer, "About" page, etc.) when the dataset is in use.

### Re-running for a new neighbourhood

The script is idempotent on cache hits. Just point it at a new centre:

```bash
node scripts/prepare-buildings.mjs --lon -79.38 --lat 43.65 --radius 600
```

Commit the regenerated `public/buildings.geojson` if you want it shipped with the app.
