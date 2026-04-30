'use client';

import { Layer, Source } from 'react-map-gl/mapbox';

type Props = { polygon: GeoJSON.Polygon | null };

export function PatioLayer({ polygon }: Props) {
  if (!polygon) return null;
  const data: GeoJSON.Feature = {
    type: 'Feature',
    geometry: polygon,
    properties: {},
  };
  return (
    <Source id="patio" type="geojson" data={data}>
      <Layer
        id="patio-fill"
        type="fill"
        slot="top"
        paint={{
          'fill-color': '#fbbf24',
          'fill-opacity': 0.35,
        }}
      />
      <Layer
        id="patio-line"
        type="line"
        slot="top"
        paint={{
          'line-color': '#f59e0b',
          'line-width': 2.5,
        }}
      />
    </Source>
  );
}
