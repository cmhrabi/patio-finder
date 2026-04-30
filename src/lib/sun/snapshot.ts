import type { Building, LngLat, MetricPolygon, ProjectedBuilding, Ring } from './types';
import { makeFrame } from './projection';
import { getSunPosition } from './sunPosition';
import { sunFraction } from './coverage';

const ALT_MIN_DEG = 3;
const PATIO_RADIUS_M = 200;

function ringCentroid(ring: number[][]): [number, number] {
  let sx = 0;
  let sy = 0;
  let n = 0;
  const last = ring.length - 1;
  const stop =
    ring.length > 1 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1]
      ? last
      : ring.length;
  for (let i = 0; i < stop; i++) {
    sx += ring[i][0];
    sy += ring[i][1];
    n++;
  }
  return [sx / n, sy / n];
}

/**
 * Compute the sun-coverage fraction (0..1) for a single patio at a single moment in time.
 *
 * Same math as one iteration of `computeSeries`, factored out so server components can
 * rank patios at "now" without spinning up the per-day cache or rendering a Mapbox map.
 *
 * Returns 1 (fully sunlit) when the sun is below the horizon's minimum tracked altitude
 * — same convention as `sunFraction`.
 */
export function computeSunSnapshotAt(
  patio: GeoJSON.Polygon,
  buildings: Building[],
  when: Date,
): { sunFraction: number; azimuthDeg: number; altitudeDeg: number } {
  const origin = ringCentroid(patio.coordinates[0] as number[][]) as LngLat;
  const [lon0, lat0] = origin;

  const frame = makeFrame(origin);
  const patioMetric: MetricPolygon = patio.coordinates.map((r) =>
    frame.ringToMetres(r as Ring),
  );

  const hMax = buildings.reduce((m, b) => (b.heightM > m ? b.heightM : m), 0);
  const maxShadowLen = hMax / Math.tan((ALT_MIN_DEG * Math.PI) / 180);
  const keepDist = maxShadowLen + PATIO_RADIUS_M;

  const snap = (v: number) => Math.round(v * 1000) / 1000;

  const projected: ProjectedBuilding[] = [];
  for (const b of buildings) {
    if (!b.footprint?.[0] || b.footprint[0].length < 4) continue;
    const fp = b.footprint.map((r) =>
      frame.ringToMetres(r as Ring).map(([x, y]) => [snap(x), snap(y)] as [number, number]),
    );
    const c = ringCentroid(fp[0]);
    const dist = Math.hypot(c[0], c[1]);
    if (dist > keepDist) continue;
    projected.push({ footprint: fp, heightM: b.heightM });
  }

  const { azimuthDeg, altitudeDeg } = getSunPosition(when, lat0, lon0);
  const fraction = sunFraction(patioMetric, projected, azimuthDeg, altitudeDeg);
  return { sunFraction: fraction, azimuthDeg, altitudeDeg };
}
