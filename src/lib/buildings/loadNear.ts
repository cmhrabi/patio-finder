// Deliberately no `import 'server-only'`: unlike the module this replaces, this
// one is also imported by CLI scripts (scripts/shadow-debug.ts), and the
// server-only marker throws outside a React Server Component. The `node:zlib`
// import below is the real barrier — it fails a client bundle loudly.
import { gunzipSync } from 'node:zlib';
import type { Building } from '@/lib/sun/types';
import {
  BUILDINGS_BUCKET,
  MANIFEST_PATH,
  TILE_SIZE_DEG,
  bboxCoversRadius,
  tileKeysCovering,
  tilePath,
  type BuildingsManifest,
  type TileKey,
} from './tiles';

/**
 * Load buildings near a point from the tiled dataset in Supabase Storage.
 *
 * Replaces the old `loadStaticBuildings()`, which read a 28.7 MB
 * `public/buildings.geojson` force-bundled into the workflow step function.
 * That coupled every coverage fix to a redeploy and made each step parse the
 * whole city to keep ~200 polygons. Tiles are fetched on demand and cached per
 * process, so a step downloads tens of KB instead.
 *
 * Caches are process-lifetime, matching the old module-level cache. Publishing
 * new data is always followed by an explicit rebuild trigger (see
 * scripts/README.md), which runs on fresh containers.
 */

type GeoJsonFC = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: {
      heightM?: number;
      heightSource?: 'avg' | 'max';
      minH?: number;
      maxH?: number;
      avgH?: number;
    } | null;
    geometry:
      | { type: 'Polygon'; coordinates: number[][][] }
      | { type: 'MultiPolygon'; coordinates: number[][][][] };
  }>;
};

/**
 * Thrown when a lookup falls outside the published extent. Distinct from "no
 * buildings here" on purpose: an empty result inside coverage is a real answer,
 * an empty result outside it is missing data, and conflating the two is what
 * produced fabricated full-sun readings for the east-end patios.
 */
export class BuildingCoverageError extends Error {
  constructor(
    readonly centre: [number, number],
    readonly radiusM: number,
    readonly manifest: BuildingsManifest,
  ) {
    super(
      `No buildings data covers [${centre[0]}, ${centre[1]}] ± ${radiusM} m. ` +
        `Published extent is [${manifest.bbox.join(', ')}] (version ${manifest.version}). ` +
        `Re-run \`npm run buildings:fetch\` to republish with a wider extent.`,
    );
    this.name = 'BuildingCoverageError';
  }
}

let manifestPromise: Promise<BuildingsManifest> | null = null;
const tileCache = new Map<string, Promise<Building[]>>();

function storageBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set — cannot load buildings');
  }
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${BUILDINGS_BUCKET}`;
}

/**
 * Memoise a promise, but drop the entry if it rejects so a retry can succeed.
 * Workflow steps auto-retry on transient failure; a permanently cached rejected
 * promise would turn one blip into a dead container.
 */
function memoise<T>(
  store: { get(): Promise<T> | null; set(p: Promise<T> | null): void },
  make: () => Promise<T>,
): Promise<T> {
  const existing = store.get();
  if (existing) return existing;
  const p = make();
  store.set(p);
  p.catch(() => {
    if (store.get() === p) store.set(null);
  });
  return p;
}

function loadManifest(): Promise<BuildingsManifest> {
  return memoise(
    {
      get: () => manifestPromise,
      set: (p) => {
        manifestPromise = p;
      },
    },
    async () => {
      const res = await fetch(`${storageBaseUrl()}/${MANIFEST_PATH}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`buildings manifest fetch failed: HTTP ${res.status}`);
      }
      const manifest = (await res.json()) as BuildingsManifest;
      if (manifest.tileSizeDeg !== TILE_SIZE_DEG) {
        throw new Error(
          `buildings manifest tileSizeDeg ${manifest.tileSizeDeg} != expected ${TILE_SIZE_DEG} — ` +
            `republish with \`npm run buildings:fetch\``,
        );
      }
      return manifest;
    },
  );
}

function featuresToBuildings(fc: GeoJsonFC): Building[] {
  const out: Building[] = [];
  for (const f of fc.features) {
    const heightM = Number(f.properties?.heightM ?? 0);
    if (!isFinite(heightM) || heightM <= 0) continue;
    const meta = {
      heightSource: f.properties?.heightSource,
      minH: f.properties?.minH,
      maxH: f.properties?.maxH,
      avgH: f.properties?.avgH,
    };
    if (f.geometry.type === 'Polygon') {
      out.push({ footprint: f.geometry.coordinates, heightM, ...meta });
    } else if (f.geometry.type === 'MultiPolygon') {
      // Split each polygon out — the sun pipeline takes a single ring set per building.
      for (const poly of f.geometry.coordinates) {
        out.push({ footprint: poly, heightM, ...meta });
      }
    }
  }
  return out;
}

function loadTile(version: string, key: TileKey): Promise<Building[]> {
  const cacheKey = `${version}:${key}`;
  return memoise(
    {
      get: () => tileCache.get(cacheKey) ?? null,
      set: (p) => {
        if (p) tileCache.set(cacheKey, p);
        else tileCache.delete(cacheKey);
      },
    },
    async () => {
      const res = await fetch(`${storageBaseUrl()}/${tilePath(version, key)}`);
      if (!res.ok) {
        throw new Error(`buildings tile ${key} fetch failed: HTTP ${res.status}`);
      }
      // Stored as an opaque gzip blob (contentType application/gzip, no
      // content-encoding) so we decompress explicitly rather than depending on
      // CDN transport decoding.
      const gz = Buffer.from(await res.arrayBuffer());
      const fc = JSON.parse(gunzipSync(gz).toString('utf8')) as GeoJsonFC;
      return featuresToBuildings(fc);
    },
  );
}

/**
 * Every building whose footprint centroid could lie within `radiusM` of
 * `centre`. This is a coarse, tile-aligned superset — callers still run
 * `filterBuildingsNear` for the precise radius cull.
 *
 * Throws `BuildingCoverageError` if the request falls outside published
 * coverage. Never returns `[]` to mean "we have no data here".
 */
export async function loadBuildingsNear(
  centre: [number, number],
  radiusM = 300,
): Promise<Building[]> {
  const manifest = await loadManifest();
  if (!bboxCoversRadius(manifest.bbox, centre, radiusM)) {
    throw new BuildingCoverageError(centre, radiusM, manifest);
  }
  const published = new Set(manifest.tiles);
  // Keys absent from the manifest are genuinely empty cells, not missing files.
  const keys = tileKeysCovering(centre, radiusM).filter((k) => published.has(k));
  const tiles = await Promise.all(keys.map((k) => loadTile(manifest.version, k)));
  return tiles.flat();
}

/** Test seam: drop the process-lifetime caches. */
export function resetBuildingsCache(): void {
  manifestPromise = null;
  tileCache.clear();
}
