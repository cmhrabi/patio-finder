import polygonClipping from 'polygon-clipping';
import type {
  MultiPolygon as PCMultiPolygon,
  Polygon as PCPolygon,
} from 'polygon-clipping';
import type { MetricMultiPolygon, MetricPolygon, ProjectedBuilding } from './types';
import { buildShadow } from './shadows';

export function ringArea(ring: number[][]): number {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function polygonArea(rings: number[][][]): number {
  let total = 0;
  for (let r = 0; r < rings.length; r++) {
    const a = ringArea(rings[r]);
    total += r === 0 ? a : -a;
  }
  return total;
}

export function multiPolygonArea(mp: MetricMultiPolygon): number {
  return mp.reduce((sum, poly) => sum + polygonArea(poly), 0);
}

// Incrementally union shadows. polygon-clipping has a known SweepLine fragility
// on certain near-degenerate inputs; if any single merge throws, we drop that
// shadow and continue rather than blowing up the whole frame.
function safeUnion(shadows: PCMultiPolygon[]): PCMultiPolygon {
  let merged: PCMultiPolygon = [];
  for (const sh of shadows) {
    if (!sh || sh.length === 0) continue;
    if (merged.length === 0) {
      merged = sh;
      continue;
    }
    try {
      merged = polygonClipping.union(merged, sh);
    } catch {
      // skip the offending shadow; the % sunlit will be a slight underestimate.
    }
  }
  return merged;
}

export function sunFraction(
  patio: MetricPolygon,
  buildings: ProjectedBuilding[],
  azimuthDeg: number,
  altitudeDeg: number,
): number {
  const patioArea = polygonArea(patio);
  if (patioArea <= 0) return 1;
  if (altitudeDeg <= 0) return 0;

  const shadows: PCMultiPolygon[] = [];
  for (const b of buildings) {
    const sh = buildShadow(b.footprint, b.heightM, azimuthDeg, altitudeDeg);
    if (sh.length > 0) shadows.push(sh as unknown as PCMultiPolygon);
  }
  if (shadows.length === 0) return 1;

  const merged = safeUnion(shadows);
  if (!merged || merged.length === 0) return 1;

  let overlap: PCMultiPolygon = [];
  try {
    overlap = polygonClipping.intersection(
      patio as unknown as PCPolygon,
      merged,
    );
  } catch {
    return 1;
  }
  if (!overlap || overlap.length === 0) return 1;

  const overlapArea = multiPolygonArea(overlap as unknown as MetricMultiPolygon);
  return Math.max(0, Math.min(1, 1 - overlapArea / patioArea));
}
