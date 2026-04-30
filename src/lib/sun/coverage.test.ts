import { describe, expect, it } from 'vitest';
import { sunFraction } from './coverage';
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
    // 10 m height → 10 m shadow length northward. Building's north edge is at
    // y=-5, so the shadow reaches y=5 — half the patio (which spans y=0..10).
    const fraction = sunFraction(PATIO, [southBuilding(10)], 180, 45);
    expect(fraction).toBeGreaterThan(0.4);
    expect(fraction).toBeLessThan(0.6);
  });

  it('leaves the patio in full sun when the building is downwind of the sun', () => {
    // Sun in the north (azimuth 0°) — shadow falls *south*, away from a
    // south-side building's footprint relative to the patio.
    const fraction = sunFraction(PATIO, [southBuilding(20)], 0, 45);
    expect(fraction).toBe(1);
  });
});
