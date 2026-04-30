import type {
  Building,
  Frame,
  LngLat,
  MetricPolygon,
  ProjectedBuilding,
  Ring,
  SunSample,
} from './types';
import { makeFrame } from './projection';
import { getDayTimes, getSunPosition } from './sunPosition';
import { sunFraction } from './coverage';

const STEP_MINUTES = 5;
const ALT_MIN_DEG = 3;
const PATIO_RADIUS_M = 200;

const cache = new Map<string, SunSample[]>();

function ymdLocal(d: Date, tz = 'America/Toronto'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function ringCentroid(ring: number[][]): [number, number] {
  let sx = 0;
  let sy = 0;
  let n = 0;
  // Skip the closing duplicate point if present
  const last = ring.length - 1;
  const stop = ring.length > 1 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1] ? last : ring.length;
  for (let i = 0; i < stop; i++) {
    sx += ring[i][0];
    sy += ring[i][1];
    n++;
  }
  return [sx / n, sy / n];
}

export type ComputeSeriesArgs = {
  patioId: string;
  patio: GeoJSON.Polygon;
  buildings: Building[];
  date: Date;
};

export function computeSeries(args: ComputeSeriesArgs): SunSample[] {
  const { patioId, patio, buildings, date } = args;
  const key = `${patioId}|${ymdLocal(date)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const origin = ringCentroid(patio.coordinates[0] as number[][]) as LngLat;
  const [lon0, lat0] = origin;

  const frame: Frame = makeFrame(origin);
  const patioMetric: MetricPolygon = patio.coordinates.map(r =>
    frame.ringToMetres(r as Ring),
  );

  const hMax = buildings.reduce((m, b) => (b.heightM > m ? b.heightM : m), 0);
  const maxShadowLen = hMax / Math.tan((ALT_MIN_DEG * Math.PI) / 180);
  const keepDist = maxShadowLen + PATIO_RADIUS_M;

  // Snap projected coordinates to 1 mm. polygon-clipping is sensitive to
  // floating-point edge cases (coincident segments, near-zero crossings);
  // rounding here removes a class of "Unable to find segment in SweepLine"
  // failures without changing the geometry visibly.
  const snap = (v: number) => Math.round(v * 1000) / 1000;

  const projected: ProjectedBuilding[] = [];
  for (const b of buildings) {
    if (!b.footprint?.[0] || b.footprint[0].length < 4) continue;
    const fp = b.footprint.map(r =>
      frame.ringToMetres(r as Ring).map(([x, y]) => [snap(x), snap(y)] as [number, number]),
    );
    const c = ringCentroid(fp[0]);
    const dist = Math.hypot(c[0], c[1]);
    if (dist > keepDist) continue;
    projected.push({ footprint: fp, heightM: b.heightM });
  }

  const times = getDayTimes(date, lat0, lon0);
  const sunrise = times.sunrise;
  const sunset = times.sunset;
  if (!sunrise || !sunset || isNaN(sunrise.getTime()) || isNaN(sunset.getTime())) {
    return [];
  }

  const samples: SunSample[] = [];
  const stepMs = STEP_MINUTES * 60_000;
  const startMs = sunrise.getTime();
  const endMs = sunset.getTime();
  for (let t = startMs; t <= endMs; t += stepMs) {
    const sampleDate = new Date(t);
    const { azimuthDeg, altitudeDeg } = getSunPosition(sampleDate, lat0, lon0);
    const fraction = sunFraction(patioMetric, projected, azimuthDeg, altitudeDeg);
    samples.push({
      time: sampleDate,
      minutesFromSunrise: (t - startMs) / 60_000,
      azimuthDeg,
      altitudeDeg,
      sunFraction: fraction,
    });
  }
  cache.set(key, samples);
  return samples;
}

export function clearSeriesCache(): void {
  cache.clear();
}
