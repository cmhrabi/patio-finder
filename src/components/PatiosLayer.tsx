'use client';

import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/mapbox';
import type { Patio } from '@/lib/patios/types';

type Props = {
  patios: Patio[];
  /** Map of patio id → 0..100 sun coverage at the active time. Missing entries render as "unknown". */
  sunPct: Record<string, number | null | undefined>;
  activeId: string | null;
};

/**
 * Renders every patio polygon, coloured by current sun fraction. The active patio
 * gets a brighter outline. Sun-data-driven fill/opacity is computed via Mapbox
 * style expressions against `properties.sunPct` so we don't have to re-render React
 * on every scrub tick.
 */
export function PatiosLayer({ patios, sunPct, activeId }: Props) {
  const data = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: patios.map((p) => ({
        type: 'Feature',
        geometry: p.polygon,
        properties: {
          id: p.id,
          name: p.name,
          sunPct: typeof sunPct[p.id] === 'number' ? sunPct[p.id] : -1,
          active: p.id === activeId ? 1 : 0,
        },
      })),
    };
  }, [patios, sunPct, activeId]);

  return (
    <Source id="patios" type="geojson" data={data}>
      <Layer
        id="patios-fill"
        type="fill"
        slot="top"
        paint={{
          // ramp: full sun → warm yellow, half → muted yellow, low → grey
          'fill-color': [
            'case',
            ['<', ['get', 'sunPct'], 0],
            '#586477', // sentinel: not yet computed → cool grey
            [
              'interpolate',
              ['linear'],
              ['get', 'sunPct'],
              0,
              '#3a4458',
              30,
              '#586477',
              55,
              '#c47812',
              75,
              '#e89a1f',
              90,
              '#ffdf7a',
              100,
              '#fff2c2',
            ],
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'active'], 1],
            0.95,
            ['<', ['get', 'sunPct'], 0],
            0.6,
            0.85,
          ],
        }}
      />
      <Layer
        id="patios-line"
        type="line"
        slot="top"
        paint={{
          'line-color': [
            'case',
            ['==', ['get', 'active'], 1],
            '#e8643a', // accent for the selected one
            'rgba(255, 245, 220, 0.4)',
          ],
          'line-width': ['case', ['==', ['get', 'active'], 1], 2.4, 1.2],
        }}
      />
    </Source>
  );
}
