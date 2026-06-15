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

/**
 * Approximate outward buffer of a simple polygon by moving each vertex
 * `distance` metres further from the polygon centroid. Good enough for the
 * small (≤2 m) buffers we want here on patio polygons that are roughly
 * convex quadrilaterals; not a substitute for a proper Minkowski-disc offset.
 */
function expandPolygonAroundCentroid(
  polygon: MetricPolygon,
  distance: number,
): MetricPolygon {
  if (distance <= 0) return polygon;
  const outer = polygon[0];
  if (!outer || outer.length < 3) return polygon;

  let cx = 0;
  let cy = 0;
  const last = outer.length - 1;
  const closed =
    outer.length > 1 &&
    outer[0][0] === outer[last][0] &&
    outer[0][1] === outer[last][1];
  const stop = closed ? last : outer.length;
  for (let i = 0; i < stop; i++) {
    cx += outer[i][0];
    cy += outer[i][1];
  }
  cx /= stop;
  cy /= stop;

  const expanded: number[][] = [];
  for (let i = 0; i < stop; i++) {
    const [x, y] = outer[i];
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      expanded.push([x, y]);
      continue;
    }
    expanded.push([x + (dx / len) * distance, y + (dy / len) * distance]);
  }
  expanded.push([expanded[0][0], expanded[0][1]]);
  return [expanded as unknown as MetricPolygon[0]];
}

/**
 * For each building whose footprint overlaps the patio polygon, subtract a
 * 1 m-buffered version of the patio out of the building's footprint. Patios
 * in this dataset are drawn by hand and frequently extend a metre or so
 * *into* the venue's host building (sidewalk patio polygons whose west edge
 * sits right against — or slightly inside — the storefront wall). When the
 * building's footprint encloses part of the patio, the shadow it casts reads
 * as 100% covering the patio (because the patio is inside the building's own
 * footprint, which is itself part of every shadow polygon).
 *
 * Clipping with a small buffer (rather than dropping the building entirely)
 * keeps the building's real walls casting shadow on whatever is on the far
 * side of it — we only pull the building back a metre from the patio so that
 * geometry mismatch in the source data doesn't turn the patio into the
 * inside of its venue's footprint.
 *
 * If the clip leaves nothing (the buffered patio completely contains the
 * footprint — unusual), drop the building entirely.
 */
const HOST_CLIP_BUFFER_M = 3;

export function clipHostBuildings<B extends ProjectedBuilding>(
  patio: MetricPolygon,
  buildings: B[],
): B[] {
  const buffered = expandPolygonAroundCentroid(patio, HOST_CLIP_BUFFER_M);
  const out: B[] = [];
  for (const b of buildings) {
    let inter: PCMultiPolygon = [];
    try {
      inter = polygonClipping.intersection(
        buffered as unknown as PCPolygon,
        b.footprint as unknown as PCPolygon,
      );
    } catch {
      out.push(b);
      continue;
    }
    if (inter.length === 0) {
      out.push(b);
      continue;
    }
    let diff: PCMultiPolygon = [];
    try {
      diff = polygonClipping.difference(
        b.footprint as unknown as PCPolygon,
        buffered as unknown as PCPolygon,
      );
    } catch {
      // On clipping failure, keep the original — worst case is the previous
      // over-shading; this isn't worse than what we had.
      out.push(b);
      continue;
    }
    if (diff.length === 0) continue; // buffered patio fully contains building
    // polygon-clipping returns a MultiPolygon; emit one Building per polygon
    // so the downstream pipeline can keep treating each as a single Polygon.
    for (const poly of diff) {
      out.push({ ...b, footprint: poly as unknown as MetricPolygon });
    }
  }
  return out;
}

export type SunCoverage = {
  sunFraction: number;
  // Intersection of the unioned building shadows with the patio, in the metric
  // frame. null when the patio is fully sunlit (or the sun is below the horizon).
  shadowOnPatio: MetricMultiPolygon | null;
};

export function computeCoverage(
  patio: MetricPolygon,
  buildings: ProjectedBuilding[],
  azimuthDeg: number,
  altitudeDeg: number,
): SunCoverage {
  const patioArea = polygonArea(patio);
  if (patioArea <= 0) return { sunFraction: 1, shadowOnPatio: null };
  if (altitudeDeg <= 0) return { sunFraction: 0, shadowOnPatio: [patio] };

  // Clip each building's shadow to the patio *before* unioning. Since
  //   patio ∩ (S₁ ∪ S₂ ∪ …) = (patio ∩ S₁) ∪ (patio ∩ S₂) ∪ …
  // this is mathematically identical to unioning the full shadows and
  // intersecting once, but far cheaper at scale: the (many) buildings whose
  // shadow misses the patio at this timestep drop out immediately, and every
  // polygon fed into safeUnion is now bounded by the (small) patio rather than
  // a sprawling shadow. That collapses the dominant polygon-clipping cost and
  // is what keeps each computePatioDay step well under the function ceiling.
  const patioPC = patio as unknown as PCPolygon;
  const clippedShadows: PCMultiPolygon[] = [];
  for (const b of buildings) {
    const sh = buildShadow(b.footprint, b.heightM, azimuthDeg, altitudeDeg);
    if (sh.length === 0) continue;
    try {
      const onPatio = polygonClipping.intersection(patioPC, sh as unknown as PCMultiPolygon);
      // Drop shadows that don't reach the patio; keep only the part that does.
      if (onPatio.length > 0) clippedShadows.push(onPatio);
    } catch {
      // Skip a shadow that fails to clip — at worst a slight underestimate of
      // shade, consistent with safeUnion's drop-the-offender policy below.
    }
  }
  if (clippedShadows.length === 0) return { sunFraction: 1, shadowOnPatio: null };

  // All pieces already live inside the patio, so their union *is* the overlap.
  const overlap = safeUnion(clippedShadows);
  if (!overlap || overlap.length === 0) return { sunFraction: 1, shadowOnPatio: null };

  const overlapMp = overlap as unknown as MetricMultiPolygon;
  const overlapArea = multiPolygonArea(overlapMp);
  const fraction = Math.max(0, Math.min(1, 1 - overlapArea / patioArea));
  return { sunFraction: fraction, shadowOnPatio: overlapMp };
}

/** @deprecated Use computeCoverage. Kept for tests and downstream callers that
 * only need the scalar. */
export function sunFraction(
  patio: MetricPolygon,
  buildings: ProjectedBuilding[],
  azimuthDeg: number,
  altitudeDeg: number,
): number {
  return computeCoverage(patio, buildings, azimuthDeg, altitudeDeg).sunFraction;
}
