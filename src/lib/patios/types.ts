export const NEIGHBOURHOODS = [
  'Little Italy',
  'Ossington',
  'Kensington',
  'Queen West',
  'Trinity Bellwoods',
  'Dundas West',
  'Junction',
  'Leslieville',
] as const;

export type Neighbourhood = (typeof NEIGHBOURHOODS)[number];

/**
 * A single outdoor seating polygon attached to a venue. The geometry lives here;
 * everything user-facing (name, hood, photo, hours) lives on the parent venue.
 */
export type VenuePatio = {
  id: string;
  /** Optional display label e.g. "Front patio" / "Back patio". */
  label: string | null;
  polygon: GeoJSON.Polygon;
};

/**
 * Public-facing venue plus all the patios that belong to it. This is the shape
 * the landing + map UI consume; the DB layer in `db.ts` joins venues_geo +
 * patios_geo and produces this.
 */
export type Venue = {
  id: string;
  name: string;
  /** Venue point-of-interest location (used for the dot marker). */
  lng: number;
  lat: number;
  hood?: Neighbourhood;
  photo?: string;
  openNow?: boolean;
  hasOutdoorSeating?: boolean;
  patios: VenuePatio[];
  createdAt: string;
};
