# Map performance — fix plan & context

Working notes for the zoom-lag fix introduced after the 3D buildings layer
landed. Phase A is done and merged; Phase C is the remaining server-side
refactor. To resume work in a fresh Claude Code session, point it here.

## Original problem

After `Buildings3DLayer` landed (`src/components/Buildings3DLayer.tsx`),
the map lagged on zoom in/out. The 3D layer wasn't itself the bug — it
amplified an existing one by enlarging and destabilising the queryable
building feature set.

## Root cause — the cascade

1. `BuildingsFromMap.tsx` listened to Mapbox `idle`. `idle` fires
   **multiple times** during a continuous zoom (one per LOD tile-load).
2. Each tick ran `extractBuildingsFromMap` →
   `map.querySourceFeatures('mb-buildings', …)` synchronously, plus four
   `console.log` calls.
3. `fingerprintBuildings` flipped on most LOD shifts → `setBuildings()`.
4. `setBuildings` re-rendered `AppShell`. `seriesByPatio` (useMemo deps
   on `buildings`) re-ran `computeSeries` for **every** patio.
5. `computeSeries` does ~180 sunrise→sunset samples per patio. Each
   sample calls `sunFraction` → `polygon-clipping.union` (super-linear)
   + `polygon-clipping.intersection`. With ~30 patios × ~180 samples × K
   buildings = **5,400+ polygon-clipping unions per building set change**,
   all synchronous on the main thread.
6. While step 5 ran, Mapbox couldn't paint zoom frames → visible jank.

Aggravating, on every timeline scrub:

- `ShadowOverlay.tsx` recomputed `computeShadowUnion` per scrub frame.
- `SunLightController.tsx` called `map.setLights(…)` per scrub frame,
  forcing a 3D-light/shadow rebuild.

## Why the 3D layer made it visible

`fill-extrusion` forces Mapbox to load building tiles at higher zoom and
finer LOD. Result: queryable feature set grows ~10× when zoomed in, and
the building fingerprint flips more often during a single zoom gesture.
The cascade ran 3–5 times per gesture instead of 0–1.

---

## Phase A — done (client-side stabilisation)

All of these are landed on `main`'s working tree.

| File | Change |
|---|---|
| `src/components/BuildingsFromMap.tsx` | `idle` → `moveend` + 300 ms debounce. Gate on zoom delta >0.25 or centre delta > radius/4. One-shot `idle` listener for initial load only. |
| `src/lib/buildings/fromMapbox.ts` | Stripped four `console.log`s + the no-height/out-of-range counters. |
| `src/lib/sun/timeSeries.ts` | Stripped per-series `console.log`s. |
| `src/lib/sun/coverage.ts` | Removed entire `debug` logging block from `sunFraction`. |
| `src/components/Buildings3DLayer.tsx` | Hoisted `paint`/`filter` to module scope (stable refs for `react-map-gl`'s deep-equal). |
| `src/components/MapboxBuildingsSource.tsx` | Hoisted pump-layer `paint` to module scope. |
| `src/components/PatiosLayer.tsx` | Hoisted both fill + line paints to module scope. |
| `src/components/ShadowOverlay.tsx` | Hoisted paint. Debounced `computeShadowUnion` by 120 ms behind sun-position changes; previous overlay shows during the scrub. |
| `src/components/SunLightController.tsx` | Wrapped `setLights` in a `requestAnimationFrame` coalescer. |

Verification done:
- `npm run typecheck` — clean.
- `npm test` — all 54 tests pass.
- `npm run lint` — no new errors in the touched files (pre-existing
  errors elsewhere were not introduced by Phase A).

To verify in browser: `npm run dev` → `/map` → zoom in/out and scrub the
timeline. In Chrome DevTools Performance, `extractBuildingsFromMap`
should appear at most 1–2 times per gesture (not per zoom frame), and
`polygonClipping.union` should not appear on the zoom critical path.

---

## Phase C — to do (server-side shadow series)

Phase A removes the cascade *during* zoom but the client still does
~30 patios × 180 samples of polygon-clipping when the building
fingerprint actually changes. The clean fix is to compute series on the
server and have the client just look up samples.

### Important: existing memory feedback

The user has saved feedback at
`~/.claude/projects/-Users-calumhrabi-patio-finder/memory/feedback_reuse_existing_data.md`
saying: when the map already shows X, query that source — don't add a
parallel client-side pipeline. Phase C **does not violate this**: the
visible 3D layer keeps using the same `mb-buildings` client source. We
add a *server-side* building dataset for compute only; we do not bolt
on a parallel client-side source.

### 1. New API route — `GET /api/sun-series?date=YYYY-MM-DD`

Returns `Record<patioId, SunSample[]>`.

- Implement at `src/app/api/sun-series/route.ts`.
- Reuse `computeSeries` from `src/lib/sun/timeSeries.ts` directly — it's
  pure TS, no DOM deps, works server-side as is.
- Patios: load via the existing Supabase server client at
  `src/lib/supabase/server.ts` (already used by
  `src/app/api/patios/route.ts` — copy that pattern).
- Buildings: load from a new Supabase `buildings` table (see step 2).
- Cache results per `(date, source_version)` either in-memory in the
  Vercel function (module-scope `Map`) or in a `sun_series` Supabase
  table. With ~30 patios × 1 row/day, persistence is trivial.

### 2. Server-side building dataset

One-shot script at `scripts/extract-buildings.ts` that:

- Reads patio centroids from Supabase.
- For each centroid, computes the set of `mapbox-streets-v8` vector tiles
  that cover a ~800 m radius (matches the existing `radiusM` default in
  `BuildingsFromMap`).
- Fetches each tile from Mapbox MTS (`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.mvt?access_token=…`).
- Parses with `@mapbox/vector-tile` + `pbf` (need to add as dev deps).
- Filters to `building` source-layer features with `extrude: true` and a
  positive `height` property.
- Persists to a Supabase `buildings` table:
  ```sql
  create table buildings (
    id text primary key,
    footprint jsonb not null,        -- GeoJSON Polygon coordinates
    height_m double precision not null,
    centroid_lng double precision not null,
    centroid_lat double precision not null,
    source_version text not null,
    created_at timestamptz default now()
  );
  create index on buildings using gist (
    st_makepoint(centroid_lng, centroid_lat)
  );
  ```
- Uses `MAPBOX_TOKEN` (or reuses `NEXT_PUBLIC_MAPBOX_TOKEN`) for tile auth.
- Re-runs only when source_version bumps — vector tile builds are rare.

### 3. Client switches from compute to fetch

In `src/components/AppShell.tsx`:

- Remove `BuildingsFromMap` usage (the component, the import, and the
  `setBuildings` state). The `mb-buildings` source / `Buildings3DLayer`
  / `MapboxBuildingsSource` stay — purely visual now.
- Replace the `seriesByPatio` `useMemo` block (currently around the
  `buildings`/`buildingsHash` deps) with a `useEffect` that fetches
  `/api/sun-series?date=…` and stores the result in a state variable
  with the same shape (`Record<string, SunSample[]>`).
- `sunPctByPatio` and downstream consumers don't need to change — they
  read off `seriesByPatio` already.
- `ShadowOverlay` needs *current-time* shadow geometry, which is one
  union (not 30 × 180). Two options:
  - **a (recommended for now):** keep the client-side computation. With
    the building set no longer churning on zoom, the single-call cost is
    fine, and the Phase A debounce already smooths scrub.
  - **b:** add `/api/shadow-overlay?date=…&t=…` returning the merged
    MultiPolygon. Cache server-side at 5-min granularity (matches
    `STEP_MINUTES = 5` in `timeSeries.ts`).

### 4. Optional — nightly pre-bake

Vercel cron / Supabase scheduled function at 03:00 Toronto time hits
`/api/sun-series?date=YYYY-MM-DD` for today and tomorrow so the first
user of the day lands on a warm cache.

### Verification for Phase C

- `curl http://localhost:3000/api/sun-series?date=2026-04-30` → JSON
  matches the existing `Record<patioId, SunSample[]>` shape. Warm second
  hit <50 ms.
- In the app, ranking-panel `sunPctByPatio` values match the pre-Phase-C
  values within rounding (same algorithm, same buildings).
- DevTools Performance: cold load → first sample visible <500 ms; zoom
  and scrub trigger zero client-side `polygon-clipping` calls.

---

## Files / paths to know

- Plan source of truth: `/Users/calumhrabi/.claude/plans/we-are-having-performance-valiant-duckling.md`
- This doc: `docs/map-performance.md`
- App shell: `src/components/AppShell.tsx`
- Map components: `src/components/{PatioMap,BuildingsFromMap,Buildings3DLayer,MapboxBuildingsSource,PatiosLayer,ShadowOverlay,SunLightController}.tsx`
- Sun math: `src/lib/sun/{timeSeries,coverage,shadowGeometry,shadows,sunPosition,projection,types}.ts`
- Building extraction: `src/lib/buildings/{fromMapbox,fingerprint}.ts`
- Patios storage (server): `src/lib/patios/storage.ts`, `src/lib/supabase/{server,client,admin}.ts`
- Existing API routes: `src/app/api/patios/route.ts`, `src/app/api/admin/{patios,venues}/route.ts`
- Mapbox version notes: `AGENTS.md`, `CLAUDE.md` (Next.js 16.2.4, React 19.2.4, Tailwind v4)

## Stack constraints worth re-reading before Phase C

- **Mapbox Standard v3** does NOT expose its basemap to
  `getStyle()`/`querySourceFeatures` — that's why we attach our own
  `mb-buildings` vector source with the invisible "tile-pump" layer
  (`MapboxBuildingsSource.tsx`). A `<Source>` with no consuming `<Layer>`
  never requests tiles. Documented in
  `~/.claude/projects/-Users-calumhrabi-patio-finder/memory/feedback_reuse_existing_data.md`.
- The map currently uses `mapbox://styles/mapbox/light-v11` not Standard
  (`AppShell.tsx:340`). Classic styles do expose `composite`, but our
  shadow extraction still uses `mb-buildings` for consistency. Don't
  switch the basemap as part of Phase C.
- **`computeSeries` is server-safe**: pure TS, only depends on
  `polygon-clipping`, `suncalc`, internal modules. No DOM/Mapbox deps.
- `STEP_MINUTES = 5` and `ALT_MIN_DEG = 3` in `timeSeries.ts` are the
  series-shape parameters. Keep these in sync between server and client
  if you split the code.
