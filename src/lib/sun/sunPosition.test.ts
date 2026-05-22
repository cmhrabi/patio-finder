import { describe, expect, it } from 'vitest';
import { getSunPosition } from './sunPosition';

// Downtown Toronto reference point (near the CN Tower).
const LAT = 43.6532;
const LON = -79.3832;

// Expected values are derived from astronomical first principles, not by
// calibrating against the current SunCalc output:
//   altitude_at_solar_noon = 90° − |lat − solar_declination|
//   declination_June_21    = +23.44°
//   declination_Dec_21     = −23.44°
//   azimuth_at_solar_noon  = 180° (sun due south for any northern hemisphere lat)
//
// The Toronto-local solar-noon UTC instant comes from
//   12:00 UTC + (longitude_W / 15) hours − equation_of_time
// with EoT ≈ −1.5 min in late June and ≈ +1.5 min in late December.
// Tolerances allow for the slop in choosing the exact UTC second.

describe('getSunPosition', () => {
  it('matches astronomical noon for Toronto on June 21 2025', () => {
    const { azimuthDeg, altitudeDeg } = getSunPosition(
      new Date('2025-06-21T17:19:00Z'),
      LAT,
      LON,
    );
    // Max altitude this lat ever sees: 90 - (43.6532 - 23.44) ≈ 69.79°.
    expect(altitudeDeg).toBeGreaterThan(68);
    expect(altitudeDeg).toBeLessThan(70.5);
    // Solar noon → due south.
    expect(azimuthDeg).toBeGreaterThan(175);
    expect(azimuthDeg).toBeLessThan(185);
  });

  it('matches astronomical noon for Toronto on December 21 2025', () => {
    const { azimuthDeg, altitudeDeg } = getSunPosition(
      new Date('2025-12-21T17:16:00Z'),
      LAT,
      LON,
    );
    // Min altitude this lat ever sees at solar noon: 90 - (43.6532 + 23.44) ≈ 22.91°.
    expect(altitudeDeg).toBeGreaterThan(21.5);
    expect(altitudeDeg).toBeLessThan(24);
    expect(azimuthDeg).toBeGreaterThan(175);
    expect(azimuthDeg).toBeLessThan(185);
  });

  it('puts the sun east of due south in the morning', () => {
    // ≈ 9 AM EDT on June 21 2025.
    const { azimuthDeg, altitudeDeg } = getSunPosition(
      new Date('2025-06-21T13:00:00Z'),
      LAT,
      LON,
    );
    expect(azimuthDeg).toBeGreaterThan(60);
    expect(azimuthDeg).toBeLessThan(150);
    expect(altitudeDeg).toBeGreaterThan(20);
  });

  it('puts the sun west of due south in the afternoon', () => {
    // ≈ 6 PM EDT on June 21 2025.
    const { azimuthDeg, altitudeDeg } = getSunPosition(
      new Date('2025-06-21T22:00:00Z'),
      LAT,
      LON,
    );
    expect(azimuthDeg).toBeGreaterThan(210);
    expect(azimuthDeg).toBeLessThan(310);
    expect(altitudeDeg).toBeGreaterThan(10);
  });

  it('has azimuth increasing monotonically through the day', () => {
    const t1 = getSunPosition(new Date('2025-06-21T13:00:00Z'), LAT, LON);
    const t2 = getSunPosition(new Date('2025-06-21T17:00:00Z'), LAT, LON);
    const t3 = getSunPosition(new Date('2025-06-21T21:00:00Z'), LAT, LON);
    expect(t2.azimuthDeg).toBeGreaterThan(t1.azimuthDeg);
    expect(t3.azimuthDeg).toBeGreaterThan(t2.azimuthDeg);
  });
});
