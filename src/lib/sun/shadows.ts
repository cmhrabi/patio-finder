import polygonClipping, { type Polygon as PCPolygon } from 'polygon-clipping';
import type { MetricMultiPolygon, MetricPolygon, MetricPoint, MetricRing } from './types';

const MIN_ALTITUDE_DEG = 3;
// Project shadows onto a plane 1 m above ground rather than z=0. People
// register "in shade" when shade hits their body, not their feet — and the
// bottom metre of every building never casts a meaningful shadow at human
// scale anyway.
const SHADOW_FLOOR_M = 1;

// Andrew's monotone chain convex hull, kept as the fallback when polygon
// clipping fails on a degenerate input. Returns a closed CCW ring.
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
//
// Computed as the Minkowski sum of the footprint with the shadow vector — the
// union of (a) the footprint itself, (b) the footprint translated in the
// shadow direction, and (c) one parallelogram per edge sweeping from edge to
// translated edge. For a convex footprint this equals the convex hull, but
// for concave / notched footprints (e.g. a building with a patio polygon
// subtracted out by clipHostBuildings) the sweep correctly leaves the notch
// unshaded. The hull approach would have bridged over the notch.
//
// Falls back to convex hull if polygon-clipping fails on a degenerate input.
export function buildShadow(
  footprint: MetricPolygon,
  heightM: number,
  azimuthDeg: number,
  altitudeDeg: number,
): MetricMultiPolygon {
  if (altitudeDeg <= MIN_ALTITUDE_DEG || heightM <= SHADOW_FLOOR_M) return [];
  const outer = footprint[0];
  if (!outer || outer.length < 3) return [];

  const altRad = (altitudeDeg * Math.PI) / 180;
  const azRad = (azimuthDeg * Math.PI) / 180;
  const len = (heightM - SHADOW_FLOOR_M) / Math.tan(altRad);
  const dx = -Math.sin(azRad) * len;
  const dy = -Math.cos(azRad) * len;

  // Per-edge parallelograms, spanning every ring (outer + any holes).
  const parallelograms: PCPolygon[] = [];
  for (const ring of footprint) {
    const n = ring.length;
    if (n < 2) continue;
    const last = n - 1;
    const closed = n > 1 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1];
    const stop = closed ? last : n - 1;
    for (let i = 0; i < stop; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[i + 1];
      parallelograms.push([[
        [ax, ay],
        [bx, by],
        [bx + dx, by + dy],
        [ax + dx, ay + dy],
        [ax, ay],
      ]]);
    }
  }

  // Translated copy of the footprint (one polygon, possibly with holes).
  const translated: MetricPolygon = footprint.map((r) =>
    r.map(([x, y]) => [x + dx, y + dy] as MetricPoint),
  );

  try {
    const result = polygonClipping.union(
      footprint as unknown as PCPolygon,
      translated as unknown as PCPolygon,
      ...parallelograms,
    );
    if (!result || result.length === 0) {
      return hullFallback(outer, dx, dy);
    }
    return result as unknown as MetricMultiPolygon;
  } catch {
    return hullFallback(outer, dx, dy);
  }
}

// Convex hull of (outer ring ∪ translated outer ring). Used only when
// polygon-clipping rejects a degenerate sweep — preserves the original MVP
// behaviour so a single bad polygon doesn't drop a building from shadow
// calculation entirely.
function hullFallback(outer: MetricRing, dx: number, dy: number): MetricMultiPolygon {
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
