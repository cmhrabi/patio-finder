import type { MetricMultiPolygon, MetricPolygon, MetricPoint } from './types';

const MIN_ALTITUDE_DEG = 3;

// Andrew's monotone chain convex hull. Returns the hull as a closed CCW ring.
function convexHull(points: MetricPoint[]): MetricPoint[] {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const cross = (o: MetricPoint, a: MetricPoint, b: MetricPoint): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: MetricPoint[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: MetricPoint[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  if (hull.length === 0) return hull;
  hull.push([hull[0][0], hull[0][1]]);
  return hull;
}

// Build the shadow polygon for a single building footprint.
// Uses the convex hull of (outer ring ∪ translated outer ring) — always a simple
// convex polygon, robust input for polygon-clipping. Slightly overestimates
// shadow area for concave footprints; acceptable for sun-fraction estimation.
export function buildShadow(
  footprint: MetricPolygon,
  heightM: number,
  azimuthDeg: number,
  altitudeDeg: number,
): MetricMultiPolygon {
  if (altitudeDeg <= MIN_ALTITUDE_DEG || heightM <= 0) return [];
  const outer = footprint[0];
  if (!outer || outer.length < 3) return [];

  const altRad = (altitudeDeg * Math.PI) / 180;
  const azRad = (azimuthDeg * Math.PI) / 180;
  const len = heightM / Math.tan(altRad);
  const dx = -Math.sin(azRad) * len;
  const dy = -Math.cos(azRad) * len;

  // Skip the closing duplicate if present.
  const n = outer.length;
  const last = n - 1;
  const closed = n > 1 && outer[0][0] === outer[last][0] && outer[0][1] === outer[last][1];
  const stop = closed ? last : n;

  const points: MetricPoint[] = [];
  for (let i = 0; i < stop; i++) {
    const [x, y] = outer[i];
    points.push([x, y]);
    points.push([x + dx, y + dy]);
  }

  const hull = convexHull(points);
  if (hull.length < 4) return [];
  return [[hull]];
}
