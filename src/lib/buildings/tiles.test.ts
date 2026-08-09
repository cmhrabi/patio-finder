import { describe, expect, it } from 'vitest';
import {
  TILE_SIZE_DEG,
  bboxContainsBBox,
  bboxCoversRadius,
  expandBBox,
  tileKeyFor,
  tileKeysCovering,
  tilePath,
  type BBox,
} from './tiles';

// Roughly the centre of the old clip box.
const DOWNTOWN: [number, number] = [-79.41, 43.647];
// Prohibition Social House — ~1.17 km east of the old clip box, the patio whose
// missing buildings produced a fabricated 94% sun reading.
const EAST_END: [number, number] = [-79.35043, 43.65881];

describe('tileKeyFor', () => {
  it('bins a coordinate into its 0.01-degree cell', () => {
    expect(tileKeyFor(-79.4601, 43.6543)).toBe('-7947_4365');
    expect(tileKeyFor(-79.4512, 43.6501)).toBe('-7946_4365');
  });

  it('places a value exactly on a cell boundary in the cell it starts', () => {
    // The float trap: -79.46 / 0.01 evaluates to -7946.000000000001, so a naive
    // floor would push this into the neighbouring cell.
    expect(tileKeyFor(-79.46, 43.65)).toBe('-7946_4365');
    expect(tileKeyFor(-79.0, 43.0)).toBe('-7900_4300');
  });

  it('is stable either side of a boundary', () => {
    expect(tileKeyFor(-79.460001, 43.65)).toBe('-7947_4365');
    expect(tileKeyFor(-79.459999, 43.65)).toBe('-7946_4365');
  });
});

describe('tileKeysCovering', () => {
  it('returns 1-4 keys for the pipeline 300 m radius at Toronto latitude', () => {
    for (const centre of [DOWNTOWN, EAST_END]) {
      const keys = tileKeysCovering(centre, 300);
      expect(keys.length).toBeGreaterThanOrEqual(1);
      expect(keys.length).toBeLessThanOrEqual(4);
    }
  });

  it('always includes the cell the centre itself falls in', () => {
    const keys = tileKeysCovering(EAST_END, 300);
    expect(keys).toContain(tileKeyFor(EAST_END[0], EAST_END[1]));
  });

  it('covers every cell a point within the radius could land in', () => {
    // Walk the radius boundary and assert each sampled point's own key is in the set.
    const [lng, lat] = DOWNTOWN;
    const radiusM = 300;
    const keys = new Set(tileKeysCovering(DOWNTOWN, radiusM));
    const dLat = radiusM / 111_320;
    const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * 2 * Math.PI;
      const key = tileKeyFor(lng + dLng * Math.cos(theta), lat + dLat * Math.sin(theta));
      expect(keys).toContain(key);
    }
  });

  it('grows with the radius', () => {
    expect(tileKeysCovering(DOWNTOWN, 5_000).length).toBeGreaterThan(
      tileKeysCovering(DOWNTOWN, 300).length,
    );
  });

  it('returns no duplicates', () => {
    const keys = tileKeysCovering(DOWNTOWN, 2_000);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('bboxCoversRadius', () => {
  // The extent the previously published dataset actually had.
  const OLD_BBOX: BBox = [-79.4651, 43.6303, -79.3639, 43.6894];

  it('rejects the east-end patios that the old clip box missed', () => {
    expect(bboxCoversRadius(OLD_BBOX, EAST_END, 300)).toBe(false);
  });

  it('accepts a patio comfortably inside', () => {
    expect(bboxCoversRadius(OLD_BBOX, DOWNTOWN, 300)).toBe(true);
  });

  it('rejects a point inside the bbox whose radius spills over the edge', () => {
    // ~48 m inside the eastern edge: the point is covered, its 300 m halo is not.
    const nearEdge: [number, number] = [-79.3645, 43.65];
    expect(bboxCoversRadius(OLD_BBOX, nearEdge, 10)).toBe(true);
    expect(bboxCoversRadius(OLD_BBOX, nearEdge, 300)).toBe(false);
  });
});

describe('expandBBox / bboxContainsBBox', () => {
  it('grows a bbox outward on all sides', () => {
    const base: BBox = [-79.42, 43.64, -79.40, 43.66];
    const grown = expandBBox(base, 3_000);
    expect(grown[0]).toBeLessThan(base[0]);
    expect(grown[1]).toBeLessThan(base[1]);
    expect(grown[2]).toBeGreaterThan(base[2]);
    expect(grown[3]).toBeGreaterThan(base[3]);
    expect(bboxContainsBBox(grown, base)).toBe(true);
    expect(bboxContainsBBox(base, grown)).toBe(false);
  });

  it('treats an identical bbox as contained', () => {
    const base: BBox = [-79.42, 43.64, -79.40, 43.66];
    expect(bboxContainsBBox(base, base)).toBe(true);
  });
});

describe('tilePath', () => {
  it('scopes tiles under their version', () => {
    expect(tilePath('2026-08-09T12-00-00-000Z-abc123', '-7946_4365')).toBe(
      '2026-08-09T12-00-00-000Z-abc123/tiles/-7946_4365.geojson.gz',
    );
  });
});

describe('TILE_SIZE_DEG', () => {
  it('is the value the published manifests are keyed on', () => {
    // Changing this invalidates every published tile; the loader checks the
    // manifest agrees, so this guards against an accidental edit.
    expect(TILE_SIZE_DEG).toBe(0.01);
  });
});
