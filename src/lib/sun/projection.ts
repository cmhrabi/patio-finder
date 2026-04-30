import type { Frame, LngLat, MetricPoint, MetricRing, Ring } from './types';

const M_PER_DEG_LAT = 110_540;

export function makeFrame(origin: LngLat): Frame {
  const [lon0, lat0] = origin;
  const mPerDegLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const toMetres = ([lng, lat]: LngLat): MetricPoint => [
    (lng - lon0) * mPerDegLon,
    (lat - lat0) * M_PER_DEG_LAT,
  ];
  const toLngLat = ([x, y]: MetricPoint): LngLat => [
    lon0 + x / mPerDegLon,
    lat0 + y / M_PER_DEG_LAT,
  ];
  return {
    origin,
    toMetres,
    toLngLat,
    ringToMetres: (r: Ring) => r.map(toMetres),
    ringToLngLat: (r: MetricRing) => r.map(toLngLat),
  };
}
