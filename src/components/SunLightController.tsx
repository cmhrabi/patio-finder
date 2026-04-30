'use client';

import { useEffect } from 'react';
import { useMap } from 'react-map-gl/mapbox';

type Props = { azimuthDeg: number; altitudeDeg: number };

export function SunLightController({ azimuthDeg, altitudeDeg }: Props) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const ref = mapRef;
    if (!ref) return;
    const map = ref.getMap();
    if (!map) return;

    // Polar angle from zenith. Clamp at the horizon so below-horizon sun
    // doesn't break the lighting math; instead we fade directional intensity to 0.
    const polar = Math.max(0, Math.min(90, 90 - altitudeDeg));
    // Smooth ramp: 0 below the horizon, full above ~6°.
    const aboveHorizon = Math.max(0, Math.min(1, altitudeDeg / 6));
    const lights = [
      {
        id: 'sun',
        type: 'directional',
        properties: {
          'cast-shadows': true,
          direction: [azimuthDeg, polar],
          intensity: 0.7 * aboveHorizon,
          'shadow-intensity': 0.85,
        },
      },
      {
        id: 'amb',
        type: 'ambient',
        properties: { intensity: 0.85 },
      },
    ];

    const apply = () => {
      try {
        // setLights is a Mapbox v3 API; cast to keep TS happy across versions.
        (map as unknown as { setLights: (l: unknown) => void }).setLights(lights);
      } catch {
        // ignored — style not ready yet
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    }
    map.on('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [mapRef, azimuthDeg, altitudeDeg]);

  return null;
}
