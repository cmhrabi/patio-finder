'use client';

import { useEffect } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import { extractBuildingsFromMap } from '@/lib/buildings/fromMapbox';
import type { Building, LngLat } from '@/lib/sun/types';

type Props = {
  center: LngLat;
  radiusM?: number;
  onBuildings: (buildings: Building[]) => void;
};

export function BuildingsFromMap({ center, radiusM = 800, onBuildings }: Props) {
  const { current } = useMap();

  useEffect(() => {
    const ref = current;
    if (!ref) return;
    const map = ref.getMap();
    if (!map) return;

    let lastCount = -1;
    const run = () => {
      const buildings = extractBuildingsFromMap(map, center, radiusM);
      // Avoid re-setting state with identical-length results on every idle tick.
      // Length is a cheap proxy: tile sets only grow as panning/zooming bring
      // new tiles in; an unchanged count after the first non-empty extraction
      // is overwhelmingly the same set.
      if (buildings.length === lastCount) return;
      lastCount = buildings.length;
      onBuildings(buildings);
    };

    if (map.isStyleLoaded() && map.areTilesLoaded()) run();
    map.on('idle', run);
    return () => {
      map.off('idle', run);
    };
  }, [current, center, radiusM, onBuildings]);

  return null;
}
