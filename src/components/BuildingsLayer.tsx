'use client';

import { Layer, Source } from 'react-map-gl/mapbox';

export function BuildingsLayer() {
  return (
    <Source id="buildings" type="geojson" data="/buildings.geojson">
      <Layer
        id="buildings-extrusion"
        type="fill-extrusion"
        slot="middle"
        paint={{
          'fill-extrusion-color': '#bdbdbd',
          'fill-extrusion-height': ['get', 'heightM'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85,
          'fill-extrusion-cast-shadows': true,
        }}
      />
    </Source>
  );
}
