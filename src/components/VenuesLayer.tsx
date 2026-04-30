'use client';

import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/mapbox';
import { VenueDots } from './VenueDots';
import type { Venue } from '@/lib/patios/types';

type Props = {
  venues: Venue[];
  /** patio-id → 0..100 sun fraction. Drives polygon colour for the active venue. */
  sunPctByPatio: Record<string, number | null | undefined>;
  /** venue-id → 0..100 best sun across that venue's patios. Drives dot fill. */
  sunPctByVenue: Record<string, number | null | undefined>;
  activeVenueId: string | null;
  /** Fires when a venue dot is clicked on the map. */
  onSelectVenue?: (id: string) => void;
};

/**
 * Two halves:
 *  - One marker per venue (`VenueDots`), rendered as a split SVG circle —
 *    sun% drives how much of the disc is yellow vs shaded. The active venue
 *    is suppressed so its patio polygons take its place.
 *  - A fill + line layer with the active venue's patio polygons.
 */
export function VenuesLayer({
  venues,
  sunPctByPatio,
  sunPctByVenue,
  activeVenueId,
  onSelectVenue,
}: Props) {
  const polygonsData = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    for (const v of venues) {
      if (v.id !== activeVenueId) continue;
      for (const p of v.patios) {
        features.push({
          type: 'Feature',
          geometry: p.polygon,
          properties: {
            id: p.id,
            venue_id: v.id,
            label: p.label,
            sunPct: typeof sunPctByPatio[p.id] === 'number' ? sunPctByPatio[p.id] : -1,
          },
        });
      }
    }
    return { type: 'FeatureCollection', features };
  }, [venues, sunPctByPatio, activeVenueId]);

  return (
    <>
      <VenueDots
        venues={venues}
        sunPctByVenue={sunPctByVenue}
        activeVenueId={activeVenueId}
        onSelectVenue={onSelectVenue}
      />

      <Source id="active-venue-patios" type="geojson" data={polygonsData}>
        <Layer
          id="active-venue-patios-fill"
          type="fill"
          slot="top"
          paint={{
            'fill-color': [
              'case',
              ['<', ['get', 'sunPct'], 0],
              '#586477',
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
            'fill-opacity': 0.95,
          }}
        />
        <Layer
          id="active-venue-patios-line"
          type="line"
          slot="top"
          paint={{
            'line-color': '#e8643a',
            'line-width': 2.4,
          }}
        />
      </Source>
    </>
  );
}
