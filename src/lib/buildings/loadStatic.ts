import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Building } from '@/lib/sun/types';

let cached: Building[] | null = null;
let loadPromise: Promise<Building[]> | null = null;

type GeoJsonFC = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: { heightM?: number } | null;
    geometry:
      | { type: 'Polygon'; coordinates: number[][][] }
      | { type: 'MultiPolygon'; coordinates: number[][][][] };
  }>;
};

/**
 * Load `public/buildings.geojson` once per server process and convert it to
 * the `Building[]` shape the sun pipeline expects. Subsequent calls return the
 * cached array — the file is ~3MB so we don't want to re-parse per request.
 */
export function loadStaticBuildings(): Promise<Building[]> {
  if (cached) return Promise.resolve(cached);
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const filepath = path.join(process.cwd(), 'public', 'buildings.geojson');
    const raw = await readFile(filepath, 'utf8');
    const fc = JSON.parse(raw) as GeoJsonFC;
    const out: Building[] = [];
    for (const f of fc.features) {
      const heightM = Number(f.properties?.heightM ?? 0);
      if (!isFinite(heightM) || heightM <= 0) continue;
      if (f.geometry.type === 'Polygon') {
        out.push({ footprint: f.geometry.coordinates, heightM });
      } else if (f.geometry.type === 'MultiPolygon') {
        // Split each polygon out — the sun pipeline takes a single ring set per building.
        for (const poly of f.geometry.coordinates) {
          out.push({ footprint: poly, heightM });
        }
      }
    }
    cached = out;
    return out;
  })();
  return loadPromise;
}
