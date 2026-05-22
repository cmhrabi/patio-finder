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
  // The portion of the patio polygon that lies in shadow at this moment, in lng/lat.
  // null when the patio is fully sunlit. Equal to the patio polygon when fully shaded.
  shadowGeoJson: GeoJSON.MultiPolygon | null;
};

export type Building = {
  footprint: number[][][];
  heightM: number;
  /** Which 3D Massing field the height came from. 'avg' is preferred for bulk
   * occlusion; 'max' is a fallback that includes parapets / antennae / spikes. */
  heightSource?: 'avg' | 'max';
  /** Raw source heights, retained for diagnostics. */
  minH?: number;
  maxH?: number;
  avgH?: number;
};

export type ProjectedBuilding = {
  footprint: MetricPolygon;
  heightM: number;
};
