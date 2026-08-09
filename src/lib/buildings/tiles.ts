/**
 * Geographic tiling scheme for the buildings dataset.
 *
 * Buildings live in Supabase Storage as one gzipped GeoJSON file per cell of a
 * fixed 0.01° grid (~0.81 km × 1.11 km at Toronto's latitude). Tile keys derive
 * purely from coordinates, so adding or moving a patio never requires
 * regenerating anything — the lookup just resolves to different cells. That is
 * the property the previous single-bbox clip lacked: it had to be widened by
 * hand whenever a patio landed outside it, and silently produced zero buildings
 * (and therefore fabricated full-sun readings) when nobody remembered to.
 *
 * This module is dependency-free and shared by both the publish script
 * (`scripts/buildings-fetch.ts`) and the runtime loader (`loadNear.ts`) so the
 * two can never disagree about which cell a coordinate belongs to.
 */

/** Cell size in degrees. Changing this invalidates every published tile. */
export const TILE_SIZE_DEG = 0.01;

/** Metres per degree of latitude — the same constant `filterNear.ts` uses. */
const M_PER_DEG = 111_320;

const MICRO = 1_000_000;
/** TILE_SIZE_DEG expressed in micro-degrees. */
const CELL_MICRO = Math.round(TILE_SIZE_DEG * MICRO);

export type TileKey = string;
/** [minLng, minLat, maxLng, maxLat] */
export type BBox = [number, number, number, number];

export type BuildingsManifest = {
  /** Version prefix the tiles live under. Immutable once published. */
  version: string;
  tileSizeDeg: number;
  /** Extent the dataset actually covers. Outside this we have no data. */
  bbox: BBox;
  /** Every tile key that has a file. A key inside `bbox` but absent here means
   * genuinely no buildings there (park, water, rail corridor) — not missing data. */
  tiles: TileKey[];
  featureCount: number;
  generatedAt: string;
};

export const BUILDINGS_BUCKET = 'buildings';
export const MANIFEST_PATH = 'manifest.json';

export function tilePath(version: string, key: TileKey): string {
  return `${version}/tiles/${key}.geojson.gz`;
}

/**
 * Cell index for one axis. Works in integer micro-degrees because the obvious
 * `Math.floor(deg / 0.01)` misbins values that land exactly on a cell boundary:
 * `-79.46 / 0.01` evaluates to `-7946.000000000001`, which floors to -7947.
 * Source coordinates are rounded to 6 decimals, so micro-degrees are exact.
 */
function cellIndex(deg: number): number {
  return Math.floor(Math.round(deg * MICRO) / CELL_MICRO);
}

export function tileKeyFor(lng: number, lat: number): TileKey {
  return `${cellIndex(lng)}_${cellIndex(lat)}`;
}

/** Guarded cos(lat) so the lng/metre conversion can't blow up near the poles. */
function cosLatClamped(lat: number): number {
  return Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
}

/** Half-extents in degrees of a `radiusM` box centred on `lat`. */
function degreeRadius(lat: number, radiusM: number): { dLng: number; dLat: number } {
  return {
    dLat: radiusM / M_PER_DEG,
    dLng: radiusM / (M_PER_DEG * cosLatClamped(lat)),
  };
}

/**
 * Every tile key touching the `radiusM` box around `centre`. At the 300 m radius
 * the sun pipeline uses this is 1–4 keys; callers with a larger reach (the
 * shadow-debug script at low sun angles) get proportionally more.
 *
 * Buildings are binned by footprint centroid, which is exactly the predicate
 * `filterBuildingsNear` already applies — so tiling introduces no behavioural
 * change, it just avoids parsing the polygons we were going to discard anyway.
 */
export function tileKeysCovering(
  centre: [number, number],
  radiusM: number,
): TileKey[] {
  const [lng, lat] = centre;
  const { dLng, dLat } = degreeRadius(lat, radiusM);
  const x0 = cellIndex(lng - dLng);
  const x1 = cellIndex(lng + dLng);
  const y0 = cellIndex(lat - dLat);
  const y1 = cellIndex(lat + dLat);
  const keys: TileKey[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      keys.push(`${x}_${y}`);
    }
  }
  return keys;
}

/**
 * True when `bbox` fully contains the `radiusM` box around `centre` — i.e. we
 * hold data for everything a lookup at that radius could need. A false result
 * must be treated as an error, never as "no buildings nearby".
 */
export function bboxCoversRadius(
  bbox: BBox,
  centre: [number, number],
  radiusM: number,
): boolean {
  const [lng, lat] = centre;
  const { dLng, dLat } = degreeRadius(lat, radiusM);
  return (
    lng - dLng >= bbox[0] &&
    lng + dLng <= bbox[2] &&
    lat - dLat >= bbox[1] &&
    lat + dLat <= bbox[3]
  );
}

/** Grow a bbox by `metres` on all sides. Used to buffer the patio extent. */
export function expandBBox(bbox: BBox, metres: number): BBox {
  const midLat = (bbox[1] + bbox[3]) / 2;
  const { dLng, dLat } = degreeRadius(midLat, metres);
  return [bbox[0] - dLng, bbox[1] - dLat, bbox[2] + dLng, bbox[3] + dLat];
}

/** True when `outer` fully contains `inner`. */
export function bboxContainsBBox(outer: BBox, inner: BBox): boolean {
  return (
    outer[0] <= inner[0] &&
    outer[1] <= inner[1] &&
    outer[2] >= inner[2] &&
    outer[3] >= inner[3]
  );
}
