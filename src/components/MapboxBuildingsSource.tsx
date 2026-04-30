'use client';

import { Source } from 'react-map-gl/mapbox';

export function MapboxBuildingsSource() {
  return (
    <Source
      id="mb-buildings"
      type="vector"
      url="mapbox://mapbox.mapbox-streets-v8"
    />
  );
}
