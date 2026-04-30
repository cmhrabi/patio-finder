'use client';

import { useEffect, useMemo } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/mapbox';
import type { MapMouseEvent } from 'mapbox-gl';
import type { Venue } from '@/lib/patios/types';

const VENUE_POINTS_LAYER = 'venue-points-circle';

type Props = {
  venues: Venue[];
  /** patio-id → 0..100 sun fraction. Drives polygon colour for the active venue. */
  sunPctByPatio: Record<string, number | null | undefined>;
  /** venue-id → 0..100 best sun across that venue's patios. Drives dot colour. */
  sunPctByVenue: Record<string, number | null | undefined>;
  activeVenueId: string | null;
  /** Fires when a venue dot is clicked on the map. */
  onSelectVenue?: (id: string) => void;
};

/**
 * The full map representation in one component:
 *  - A circle layer with one dot per venue (always visible). The active venue's
 *    dot is filtered out so it doesn't compete with its own polygons.
 *  - A fill + line layer with the active venue's patio polygons (only).
 *
 * Two `<Source>`s, four `<Layer>`s — both data-driven via Mapbox style
 * expressions, so re-rendering happens at the GPU level when sun% updates.
 */
export function VenuesLayer({
  venues,
  sunPctByPatio,
  sunPctByVenue,
  activeVenueId,
  onSelectVenue,
}: Props) {
  const { current: mapRef } = useMap();

  // Wire dot clicks → onSelectVenue, plus a pointer cursor on hover so the
  // dots feel obviously interactive.
  useEffect(() => {
    if (!mapRef || !onSelectVenue) return;
    const map = mapRef.getMap();

    const handleClick = (e: MapMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === 'string') onSelectVenue(id);
    };
    const handleEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', VENUE_POINTS_LAYER, handleClick);
    map.on('mouseenter', VENUE_POINTS_LAYER, handleEnter);
    map.on('mouseleave', VENUE_POINTS_LAYER, handleLeave);

    return () => {
      map.off('click', VENUE_POINTS_LAYER, handleClick);
      map.off('mouseenter', VENUE_POINTS_LAYER, handleEnter);
      map.off('mouseleave', VENUE_POINTS_LAYER, handleLeave);
      map.getCanvas().style.cursor = '';
    };
  }, [mapRef, onSelectVenue]);

  const venuesData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: venues.map((v) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
        properties: {
          id: v.id,
          name: v.name,
          sunPct: typeof sunPctByVenue[v.id] === 'number' ? sunPctByVenue[v.id] : -1,
          // 1 when the active venue → its dot is filtered out; the polygons take over.
          active: v.id === activeVenueId ? 1 : 0,
        },
      })),
    }),
    [venues, sunPctByVenue, activeVenueId],
  );

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
      <Source id="venue-points" type="geojson" data={venuesData}>
        <Layer
          id="venue-points-circle"
          type="circle"
          slot="top"
          // Hide the dot for the active venue — its polygons render in its place.
          filter={['==', ['get', 'active'], 0]}
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              11,
              4,
              16,
              8,
              18,
              10,
            ],
            // Black → bright yellow ramp keyed off the venue's best sun% at
            // the active scrub time. Intermediate amber stops avoid the muddy
            // olive that pure linear black→yellow interpolation produces.
            'circle-color': [
              'case',
              ['<', ['get', 'sunPct'], 0],
              '#586477', // sentinel: still computing → neutral cool grey
              [
                'interpolate',
                ['linear'],
                ['get', 'sunPct'],
                0, '#0a0a0a',   // near-black — fully shaded
                40, '#3a2810',  // very dark amber
                70, '#c47812',  // sun-500
                100, '#ffeb3b', // bright vivid yellow — fully sunlit
              ],
            ],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#0a0a0a',
            'circle-opacity': 0.98,
          }}
        />
      </Source>

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
