import type {
  Building,
  Frame,
  LngLat,
  MetricMultiPolygon,
  MetricPolygon,
  MetricRing,
  ProjectedBuilding,
  Ring,
  SunSample,
} from './types';
import { makeFrame } from './projection';
import { getDayTimes, getSunPosition } from './sunPosition';
import { computeCoverage, clipHostBuildings } from './coverage';

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

function metricMpToGeoJson(
  mp: MetricMultiPolygon | null,
  frame: Frame,
): GeoJSON.MultiPolygon | null {
  if (!mp || mp.length === 0) return null;
  const coordinates: number[][][][] = mp.map((poly) =>
    poly.map((ring) => frame.ringToLngLat(ring as MetricRing) as number[][]),
  );
  return { type: 'MultiPolygon', coordinates };
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

  // Pre-project all buildings within an absolute cap. The per-step filter below
  // (`b.distM <= b.heightM / tan(alt) + PATIO_RADIUS_M`) is what actually decides
  // relevance per timestep; this cap bounds both the upfront projection cost and
  // the universe the per-step filter draws from. Kept at 200 m to keep the batch
  // tractable — buildings farther than this contribute shadows only at very low
  // sun altitudes, which we already floor out via ALT_MIN_DEG.
  const ABSOLUTE_MAX_M = 200;
  const snap = (v: number) => Math.round(v * 1000) / 1000;

  const projectedAll: (ProjectedBuilding & { distM: number })[] = [];
  for (const b of buildings) {
    if (!b.footprint?.[0] || b.footprint[0].length < 4) continue;
    const fp = b.footprint.map(r =>
      frame.ringToMetres(r as Ring).map(([x, y]) => [snap(x), snap(y)] as [number, number]),
    );
    const c = ringCentroid(fp[0]);
    const dist = Math.hypot(c[0], c[1]);
    if (dist > ABSOLUTE_MAX_M) continue;
    projectedAll.push({ footprint: fp, heightM: b.heightM, distM: dist });
  }
  // Clip out the part of any building footprint that overlaps the patio
  // polygon — see clipHostBuildings docs in coverage.ts. The building's real
  // walls still cast shadow on whatever is east/away from it; we only remove
  // the bit drawn on top of the patio (which makes shadows read as 100%).
  const projected = clipHostBuildings(patioMetric, projectedAll);
  const clippedDelta = projected.length - projectedAll.length;

  console.log(`[timeSeries] ${patioId} / ${ymdLocal(date)}: ${projected.length} buildings within ${ABSOLUTE_MAX_M} m (host-clip delta: ${clippedDelta >= 0 ? '+' : ''}${clippedDelta})`)
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

    let fraction: number;
    let shadowMetric: MetricMultiPolygon | null;
    if (altitudeDeg <= ALT_MIN_DEG) {
      // Sun too low for shadow math to be reliable — treat as fully shaded.
      // The previous implementation passed an empty building list down to
      // sunFraction(), which interprets "no shadows" as "fully sunny" and
      // produced a spurious spike at sunrise on every chart. Anything above
      // a single storey blocks grazing sun, so 0 is far closer to truth than 1.
      fraction = 0;
      shadowMetric = [patioMetric];
    } else {
      // Per-step filter: only buildings whose shadow can actually reach the
      // patio at this sun altitude. At 30° a 10m building casts a 17m shadow
      // — no need to polygon-clip buildings 500m away.
      const altRad = (altitudeDeg * Math.PI) / 180;
      const relevant = projected.filter(
        b => b.distM <= b.heightM / Math.tan(altRad) + PATIO_RADIUS_M,
      );
      const cov = computeCoverage(patioMetric, relevant, azimuthDeg, altitudeDeg);
      fraction = cov.sunFraction;
      shadowMetric = cov.shadowOnPatio;
    }

    samples.push({
      time: sampleDate,
      minutesFromSunrise: (t - startMs) / 60_000,
      azimuthDeg,
      altitudeDeg,
      sunFraction: fraction,
      shadowGeoJson: metricMpToGeoJson(shadowMetric, frame),
    });
  }
  console.log(`[timeSeries] ${patioId} / ${ymdLocal(date)}: done (${samples.length} samples)`)
  cache.set(key, samples);
  return samples;
}

export function clearSeriesCache(): void {
  cache.clear();
}
