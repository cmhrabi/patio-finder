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

export type Patio = {
  id: string;
  name: string;
  polygon: GeoJSON.Polygon;
  createdAt: string;
  /** Optional descriptive metadata — only present on seed/curated patios. */
  hood?: Neighbourhood;
  photo?: string;
  openNow?: boolean;
  hasOutdoorSeating?: boolean;
};
