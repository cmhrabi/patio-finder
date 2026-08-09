import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import {
  BuildingCoverageError,
  loadBuildingsNear,
  resetBuildingsCache,
} from './loadNear';
import { tileKeyFor, type BuildingsManifest } from './tiles';

const SUPABASE_URL = 'https://example.supabase.co';
const DOWNTOWN: [number, number] = [-79.41, 43.647];
const OUTSIDE: [number, number] = [-79.0, 43.65];

function manifest(overrides: Partial<BuildingsManifest> = {}): BuildingsManifest {
  return {
    version: 'v-test',
    tileSizeDeg: 0.01,
    bbox: [-79.5, 43.6, -79.3, 43.7],
    tiles: [tileKeyFor(DOWNTOWN[0], DOWNTOWN[1])],
    featureCount: 1,
    generatedAt: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

function tileBody(features: unknown[]): Buffer {
  return gzipSync(Buffer.from(JSON.stringify({ type: 'FeatureCollection', features })));
}

const SQUARE = [
  [
    [-79.411, 43.6465],
    [-79.410, 43.6465],
    [-79.410, 43.6475],
    [-79.411, 43.6475],
    [-79.411, 43.6465],
  ],
];

/** Route fetches by URL suffix so tests only describe what they care about. */
function stubFetch(routes: { manifest?: BuildingsManifest; tiles?: Record<string, Buffer> }) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/manifest.json')) {
      if (!routes.manifest) return new Response('missing', { status: 404 });
      return new Response(JSON.stringify(routes.manifest), { status: 200 });
    }
    for (const [key, body] of Object.entries(routes.tiles ?? {})) {
      if (url.endsWith(`/tiles/${key}.geojson.gz`)) {
        return new Response(new Uint8Array(body), { status: 200 });
      }
    }
    return new Response('not found', { status: 404 });
  });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
  resetBuildingsCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('loadBuildingsNear', () => {
  it('throws BuildingCoverageError outside the published extent', async () => {
    vi.stubGlobal('fetch', stubFetch({ manifest: manifest() }));
    await expect(loadBuildingsNear(OUTSIDE, 300)).rejects.toBeInstanceOf(
      BuildingCoverageError,
    );
  });

  it('does not silently return an empty set outside coverage', async () => {
    // The whole point: "no data here" must never look like "no buildings here",
    // which is what produced fabricated full-sun rows for the east-end patios.
    vi.stubGlobal('fetch', stubFetch({ manifest: manifest() }));
    await expect(loadBuildingsNear(OUTSIDE, 300)).rejects.toThrow(/No buildings data covers/);
  });

  it('loads and parses tiles listed in the manifest', async () => {
    const key = tileKeyFor(DOWNTOWN[0], DOWNTOWN[1]);
    vi.stubGlobal(
      'fetch',
      stubFetch({
        manifest: manifest(),
        tiles: {
          [key]: tileBody([
            {
              type: 'Feature',
              properties: { heightM: 24.5, heightSource: 'avg' },
              geometry: { type: 'Polygon', coordinates: SQUARE },
            },
          ]),
        },
      }),
    );
    const buildings = await loadBuildingsNear(DOWNTOWN, 300);
    expect(buildings).toHaveLength(1);
    expect(buildings[0].heightM).toBe(24.5);
    expect(buildings[0].heightSource).toBe('avg');
    expect(buildings[0].footprint).toEqual(SQUARE);
  });

  it('treats a manifest-absent tile as genuinely empty rather than erroring', async () => {
    // A cell with no buildings (park, water, rail corridor) has no file at all.
    // Inside the bbox that is a real answer, so it must not 404 the whole load.
    vi.stubGlobal('fetch', stubFetch({ manifest: manifest({ tiles: [] }) }));
    await expect(loadBuildingsNear(DOWNTOWN, 300)).resolves.toEqual([]);
  });

  it('splits MultiPolygon buildings into one entry per polygon', async () => {
    const key = tileKeyFor(DOWNTOWN[0], DOWNTOWN[1]);
    vi.stubGlobal(
      'fetch',
      stubFetch({
        manifest: manifest(),
        tiles: {
          [key]: tileBody([
            {
              type: 'Feature',
              properties: { heightM: 10 },
              geometry: { type: 'MultiPolygon', coordinates: [SQUARE, SQUARE] },
            },
          ]),
        },
      }),
    );
    await expect(loadBuildingsNear(DOWNTOWN, 300)).resolves.toHaveLength(2);
  });

  it('drops features with a zero or missing height', async () => {
    const key = tileKeyFor(DOWNTOWN[0], DOWNTOWN[1]);
    vi.stubGlobal(
      'fetch',
      stubFetch({
        manifest: manifest(),
        tiles: {
          [key]: tileBody([
            {
              type: 'Feature',
              properties: { heightM: 0 },
              geometry: { type: 'Polygon', coordinates: SQUARE },
            },
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'Polygon', coordinates: SQUARE },
            },
          ]),
        },
      }),
    );
    await expect(loadBuildingsNear(DOWNTOWN, 300)).resolves.toEqual([]);
  });

  it('rejects a manifest whose tile size disagrees with the code', async () => {
    vi.stubGlobal('fetch', stubFetch({ manifest: manifest({ tileSizeDeg: 0.05 }) }));
    await expect(loadBuildingsNear(DOWNTOWN, 300)).rejects.toThrow(/tileSizeDeg/);
  });

  it('surfaces a failed tile fetch instead of yielding an empty set', async () => {
    const key = tileKeyFor(DOWNTOWN[0], DOWNTOWN[1]);
    // Manifest lists the tile, but the object is missing — a truncated publish.
    vi.stubGlobal('fetch', stubFetch({ manifest: manifest(), tiles: {} }));
    await expect(loadBuildingsNear(DOWNTOWN, 300)).rejects.toThrow(
      new RegExp(`tile ${key.replace(/[-]/g, '\\-')} fetch failed`),
    );
  });

  it('fetches the manifest once across repeated calls', async () => {
    const key = tileKeyFor(DOWNTOWN[0], DOWNTOWN[1]);
    const fetchMock = stubFetch({
      manifest: manifest(),
      tiles: {
        [key]: tileBody([
          {
            type: 'Feature',
            properties: { heightM: 10 },
            geometry: { type: 'Polygon', coordinates: SQUARE },
          },
        ]),
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    await loadBuildingsNear(DOWNTOWN, 300);
    await loadBuildingsNear(DOWNTOWN, 300);
    const manifestCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith('/manifest.json'),
    );
    expect(manifestCalls).toHaveLength(1);
  });

  it('retries the manifest after a transient failure', async () => {
    // A rejected promise must not stay cached — workflow steps auto-retry.
    let attempt = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/manifest.json')) {
          attempt++;
          if (attempt === 1) return new Response('boom', { status: 500 });
          return new Response(JSON.stringify(manifest({ tiles: [] })), { status: 200 });
        }
        return new Response('not found', { status: 404 });
      }),
    );
    await expect(loadBuildingsNear(DOWNTOWN, 300)).rejects.toThrow(/HTTP 500/);
    await expect(loadBuildingsNear(DOWNTOWN, 300)).resolves.toEqual([]);
    expect(attempt).toBe(2);
  });
});
