'use client';

import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/mapbox';
import { VenueDots } from './VenueDots';
import type { Venue } from '@/lib/patios/types';

type Props = {
  venues: Venue[];
  /** patio-id → 0..100 sun fraction. Kept around for future legend/tooltip use. */
  sunPctByPatio: Record<string, number | null | undefined>;
  /**
   * patio-id → GeoJSON MultiPolygon describing the part of the patio that lies
   * in shadow at the active timestep. `null` when the patio is fully sunlit.
   */
  shadowByPatio: Record<string, GeoJSON.MultiPolygon | null | undefined>;
  /** venue-id → 0..100 best sun across that venue's patios. Drives dot fill. */
  sunPctByVenue: Record<string, number | null | undefined>;
  activeVenueId: string | null;
  /** Fires when a venue dot is clicked on the map. */
  onSelectVenue?: (id: string) => void;
};

const SUNLIT_FILL = '#fff2c2';
const SHADOW_FILL = '#3a4458';

/**
 * Two halves:
 *  - One marker per venue (`VenueDots`), rendered as a split SVG circle —
 *    sun% drives how much of the disc is yellow vs shaded. The active venue
 *    is suppressed so its patio polygons take its place.
 *  - The active venue's patios: a flat sunlit fill underneath, the precomputed
 *    shadow∩patio polygon on top, and the orange outline above both.
 */
export function VenuesLayer({
  venues,
  shadowByPatio,
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
          properties: { id: p.id, venue_id: v.id, label: p.label },
        });
      }
    }
    return { type: 'FeatureCollection', features };
  }, [venues, activeVenueId]);

  const shadowsData = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    for (const v of venues) {
      if (v.id !== activeVenueId) continue;
      for (const p of v.patios) {
        const shadow = shadowByPatio[p.id];
        if (!shadow) continue;
        features.push({
          type: 'Feature',
          geometry: shadow,
          properties: { id: p.id, venue_id: v.id },
        });
      }
    }
    return { type: 'FeatureCollection', features };
  }, [venues, shadowByPatio, activeVenueId]);

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
            'fill-color': SUNLIT_FILL,
            'fill-opacity': 0.85,
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

      <Source id="active-venue-patio-shadows" type="geojson" data={shadowsData}>
        <Layer
          id="active-venue-patio-shadows-fill"
          type="fill"
          slot="top"
          paint={{
            'fill-color': SHADOW_FILL,
            'fill-opacity': 0.85,
          }}
        />
      </Source>
    </>
  );
}
