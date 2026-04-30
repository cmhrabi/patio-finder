export type LngLat = [number, number];
export type Ring = LngLat[];
export type Polygon = Ring[];

export type MetricPoint = [number, number];
export type MetricRing = MetricPoint[];
export type MetricPolygon = MetricRing[];
export type MetricMultiPolygon = MetricPolygon[];

export type Frame = {
  origin: LngLat;
  toMetres: (p: LngLat) => MetricPoint;
  toLngLat: (p: MetricPoint) => LngLat;
  ringToMetres: (r: Ring) => MetricRing;
  ringToLngLat: (r: MetricRing) => Ring;
};

export type SunSample = {
  time: Date;
  minutesFromSunrise: number;
  azimuthDeg: number;
  altitudeDeg: number;
  sunFraction: number;
};

export type Building = {
  footprint: number[][][];
  heightM: number;
};

export type ProjectedBuilding = {
  footprint: MetricPolygon;
  heightM: number;
};
