import type { Building, LngLat, MetricPolygon, ProjectedBuilding, Ring } from './types';
import { makeFrame } from './projection';
import { getSunPosition } from './sunPosition';
import { sunFraction } from './coverage';

/** Hard floor when the sun is so low the shadow filter would keep everything. */
const ALT_MIN_DEG = 8;
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
 * Designed to be called server-side from the landing page (3851 buildings × 14 patios
 * needs to come back in well under a second). Two cheap filters drop most buildings
 * before any shadow geometry is built:
 *
 *  1. **Lat/lon bbox** — skip buildings whose footprint is way outside the patio's
 *     plausible shadow zone. Uses cheap degree → metre approximations.
 *  2. **Per-building shadow reach** — driven by the *actual* sun altitude, not the
 *     worst-case minimum. At a 45° sun a 50m building only shadows ~50m, so most of
 *     the dataset is irrelevant for any given patio at any given moment.
 *
 * Returns 0 when the sun is below the horizon and 1 if the sun is too low to bother
 * casting (matches `sunFraction`'s convention).
 */
export function computeSunSnapshotAt(
  patio: GeoJSON.Polygon,
  buildings: Building[],
  when: Date,
): { sunFraction: number; azimuthDeg: number; altitudeDeg: number } {
  const origin = ringCentroid(patio.coordinates[0] as number[][]) as LngLat;
  const [lon0, lat0] = origin;

  const { azimuthDeg, altitudeDeg } = getSunPosition(when, lat0, lon0);
  if (altitudeDeg <= 0) {
    return { sunFraction: 0, azimuthDeg, altitudeDeg };
  }

  // Effective altitude for distance budgeting. Floor it so a 1° sun doesn't blow up
  // the keep distance to infinity, but use the actual altitude when it's higher than
  // the floor — that's the whole point of computing this per-snapshot.
  const effAltDeg = Math.max(altitudeDeg, ALT_MIN_DEG);
  const tanAlt = Math.tan((effAltDeg * Math.PI) / 180);

  // Pre-filter by latitude/longitude bbox before doing any projection. This converts
  // the metric keep-distance for the *tallest plausible* building (cap at 250m, the
  // tallest residential downtown ought to come in under that) back into degrees.
  const HEIGHT_CAP = 250;
  const maxKeepM = HEIGHT_CAP / tanAlt + PATIO_RADIUS_M;
  // 1° latitude ≈ 111 km; 1° longitude ≈ 111 km × cos(lat).
  const dLat = maxKeepM / 111_000;
  const dLon = maxKeepM / (111_000 * Math.cos((lat0 * Math.PI) / 180));

  const candidates: Building[] = [];
  for (const b of buildings) {
    const fp0 = b.footprint?.[0];
    if (!fp0 || fp0.length < 4) continue;
    // Bbox-by-first-vertex is approximate but fine — buildings are tiny relative to
    // the keep window and we follow up with a precise distance check after projection.
    const [bx, by] = fp0[0];
    if (Math.abs(by - lat0) > dLat) continue;
    if (Math.abs(bx - lon0) > dLon) continue;
    candidates.push(b);
  }

  // Now do the (expensive) projection — but only on the cheap-prefiltered subset.
  const frame = makeFrame(origin);
  const patioMetric: MetricPolygon = patio.coordinates.map((r) =>
    frame.ringToMetres(r as Ring),
  );

  const snap = (v: number) => Math.round(v * 1000) / 1000;
  const projected: ProjectedBuilding[] = [];
  for (const b of candidates) {
    const fp = b.footprint.map((r) =>
      frame.ringToMetres(r as Ring).map(([x, y]) => [snap(x), snap(y)] as [number, number]),
    );
    // Per-building precise distance from patio centre, against the per-building
    // shadow reach (height / tan(altitude)). Tall buildings far away still kept;
    // short buildings far away dropped.
    const c = ringCentroid(fp[0]);
    const dist = Math.hypot(c[0], c[1]);
    const buildingKeep = b.heightM / tanAlt + PATIO_RADIUS_M;
    if (dist > buildingKeep) continue;
    projected.push({ footprint: fp, heightM: b.heightM });
  }

  const fraction = sunFraction(patioMetric, projected, azimuthDeg, altitudeDeg);
  return { sunFraction: fraction, azimuthDeg, altitudeDeg };
}
