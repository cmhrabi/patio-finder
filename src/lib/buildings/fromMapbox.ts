import type { Map as MapboxMap } from 'mapbox-gl';
import type { Building, LngLat } from '@/lib/sun/types';

const SOURCE_ID = 'mb-buildings';
const SOURCE_LAYER = 'building';
const M_PER_DEG_LAT = 111_320;

export function extractBuildingsFromMap(
  map: MapboxMap,
  center: LngLat,
  radiusM = 800,
): Building[] {
  const feats = map.querySourceFeatures(SOURCE_ID, {
    sourceLayer: SOURCE_LAYER,
    filter: ['==', ['get', 'extrude'], 'true'],
  });

  const seen = new Set<string>();
  const out: Building[] = [];
  const [lon0, lat0] = center;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);

  const within = (lng: number, lat: number) => {
    const dx = (lng - lon0) * mPerDegLon;
    const dy = (lat - lat0) * M_PER_DEG_LAT;
    return Math.hypot(dx, dy) <= radiusM;
  };

  for (const f of feats) {
    const id = f.id != null ? String(f.id) : '';
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);

    const h = Number((f.properties as { height?: unknown } | null)?.height);
    if (!Number.isFinite(h) || h <= 0) continue;
    if (!f.geometry) continue;

    if (f.geometry.type === 'Polygon') {
      const rings = (f.geometry as GeoJSON.Polygon).coordinates as number[][][];
      const ring0 = rings[0];
      if (!ring0 || ring0.length < 4) continue;
      const [lng, lat] = ring0[0];
      if (!within(lng, lat)) continue;
      out.push({ footprint: rings, heightM: h });
    } else if (f.geometry.type === 'MultiPolygon') {
      const polys = (f.geometry as GeoJSON.MultiPolygon).coordinates as number[][][][];
      for (const rings of polys) {
        const ring0 = rings[0];
        if (!ring0 || ring0.length < 4) continue;
        const [lng, lat] = ring0[0];
        if (!within(lng, lat)) continue;
        out.push({ footprint: rings, heightM: h });
      }
    }
  }
  return out;
}
