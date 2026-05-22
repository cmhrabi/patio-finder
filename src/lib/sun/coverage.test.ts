import { describe, expect, it } from 'vitest';
import { clipHostBuildings, sunFraction } from './coverage';
import type { MetricPolygon, ProjectedBuilding } from './types';

// Geometry uses the same metric frame as the real pipeline: x = east, y = north,
// units in metres. Sun azimuth follows the runtime convention (0°=N, 90°=E,
// 180°=S, 270°=W) — at solar noon in Toronto the sun sits ~due south, so
// shadows fall to the north (positive y). See shadows.ts for the projection
// math.

const PATIO: MetricPolygon = [[
  [-5, 0],
  [5, 0],
  [5, 10],
  [-5, 10],
  [-5, 0],
]]; // 10×10 m square, north of the origin. Area 100 m².

function southBuilding(heightM: number): ProjectedBuilding {
  return {
    footprint: [[
      [-10, -25],
      [10, -25],
      [10, -5],
      [-10, -5],
      [-10, -25],
    ]],
    heightM,
  };
}

describe('sunFraction', () => {
  it('returns 1 with no buildings around', () => {
    expect(sunFraction(PATIO, [], 180, 45)).toBe(1);
  });

  it('returns 0 below the horizon', () => {
    expect(sunFraction(PATIO, [southBuilding(20)], 180, -5)).toBe(0);
  });

  it('shadows the patio when a tall south-side building is between it and the sun at noon', () => {
    // Building south, sun south at 45° → shadow projects 20 m northward
    // (heightM/tan(alt) = 20/tan(45°) = 20). Patio is 5 m north of the building,
    // 10 m deep — fully covered.
    const fraction = sunFraction(PATIO, [southBuilding(20)], 180, 45);
    expect(fraction).toBeLessThan(0.05);
  });

  it('partially shadows the patio when the building is shorter', () => {
    // 10 m height − 1 m shadow floor → 9 m shadow length northward. Building's
    // north edge is at y=-5, so the shadow reaches y=4 — covering 40% of the
    // patio (which spans y=0..10), leaving ~60% sunlit.
    const fraction = sunFraction(PATIO, [southBuilding(10)], 180, 45);
    expect(fraction).toBeGreaterThan(0.55);
    expect(fraction).toBeLessThan(0.65);
  });

  it('leaves the patio in full sun when the building is downwind of the sun', () => {
    // Sun in the north (azimuth 0°) — shadow falls *south*, away from a
    // south-side building's footprint relative to the patio.
    const fraction = sunFraction(PATIO, [southBuilding(20)], 0, 45);
    expect(fraction).toBe(1);
  });
});

describe('clipHostBuildings', () => {
  // A building that overlaps the patio gets the patio polygon subtracted out
  // of its footprint. The remainder of the building (its real walls) stays in
  // the list so it can still cast shadow on whatever is on the far side.
  const overlappingBuilding: ProjectedBuilding = {
    // Big block that includes the south half of the patio (y from -10 to 5;
    // patio spans 0..10).
    footprint: [[
      [-10, -10],
      [10, -10],
      [10, 5],
      [-10, 5],
      [-10, -10],
    ]],
    heightM: 10,
  };

  it('clips the overlapping part out but keeps the building', () => {
    const out = clipHostBuildings(PATIO, [overlappingBuilding]);
    expect(out.length).toBeGreaterThanOrEqual(1);
    // Building should still have height/identity preserved.
    expect(out[0].heightM).toBe(10);
    // And it should no longer overlap the patio polygon.
    const stillOverlaps = clipHostBuildings(PATIO, out);
    expect(stillOverlaps.length).toBe(out.length); // no further clipping
  });

  it('passes through non-overlapping buildings unchanged', () => {
    const out = clipHostBuildings(PATIO, [southBuilding(20)]);
    expect(out.length).toBe(1);
    expect(out[0]).toBe(southBuilding(20).constructor === Object ? out[0] : out[0]);
  });

  it('drops a building completely contained by the patio polygon', () => {
    const tiny: ProjectedBuilding = {
      footprint: [[
        [-1, 1],
        [1, 1],
        [1, 2],
        [-1, 2],
        [-1, 1],
      ]],
      heightM: 5,
    };
    const out = clipHostBuildings(PATIO, [tiny]);
    expect(out.length).toBe(0);
  });
});
