'use client';

import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { useControl } from 'react-map-gl/mapbox';
import type { ControlPosition } from 'react-map-gl/mapbox';

type DrawEvent = { features: Array<{ geometry: GeoJSON.Polygon; id: string }> };

type Props = {
  position?: ControlPosition;
  onCreate?: (e: DrawEvent) => void;
  onUpdate?: (e: DrawEvent) => void;
  onDelete?: (e: DrawEvent) => void;
};

export function DrawControl({ position = 'top-left', onCreate, onUpdate, onDelete }: Props) {
  useControl(
    () =>
      new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: 'draw_polygon',
      }),
    ({ map }) => {
      if (onCreate) map.on('draw.create', onCreate as never);
      if (onUpdate) map.on('draw.update', onUpdate as never);
      if (onDelete) map.on('draw.delete', onDelete as never);
    },
    ({ map }) => {
      if (onCreate) map.off('draw.create', onCreate as never);
      if (onUpdate) map.off('draw.update', onUpdate as never);
      if (onDelete) map.off('draw.delete', onDelete as never);
    },
    { position },
  );
  return null;
}
