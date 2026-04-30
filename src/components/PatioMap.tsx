'use client';

import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Map, { type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

export type StandardLightPreset = 'day' | 'dusk' | 'dawn' | 'night';
export type StandardTheme = 'default' | 'faded' | 'monochrome';

export type PatioMapProps = {
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom?: number;
    pitch?: number;
    bearing?: number;
  };
  mapStyle?: string;
  /** Mapbox Standard basemap config — only applied when the style is `standard`. */
  basemapTheme?: StandardTheme;
  basemapLightPreset?: StandardLightPreset;
  children?: ReactNode;
};

const DEFAULT_VIEW = {
  longitude: -79.3832,
  latitude: 43.6532,
  zoom: 12,
};

const PatioMap = forwardRef<MapRef, PatioMapProps>(function PatioMap(
  { initialViewState, mapStyle, basemapTheme, basemapLightPreset, children },
  forwardedRef,
) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const internalRef = useRef<MapRef | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Merge forwarded ref + internal ref so we can apply config from the inside
  // without losing the parent's access to the map.
  const setRefs = useCallback(
    (node: MapRef | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const handleLoad = useCallback(() => setLoaded(true), []);

  // Apply Mapbox Standard basemap config — and re-apply when the props change
  // (e.g. when the time-scrubber switches from `day` to `dusk`).
  // setConfigProperty is a no-op on non-Standard styles; wrap in a try in case
  // the API isn't present on an older mapbox-gl build.
  useEffect(() => {
    if (!loaded) return;
    const map = internalRef.current?.getMap();
    if (!map) return;
    try {
      if (basemapTheme) map.setConfigProperty('basemap', 'theme', basemapTheme);
      if (basemapLightPreset)
        map.setConfigProperty('basemap', 'lightPreset', basemapLightPreset);
    } catch {
      // ignore — non-Standard style or unsupported API.
    }
  }, [loaded, basemapTheme, basemapLightPreset]);

  if (!token) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-100 p-8 text-center text-sm text-neutral-700">
        Missing <code className="mx-1 rounded bg-neutral-200 px-1 py-0.5 font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code>.
        Copy <code className="mx-1 rounded bg-neutral-200 px-1 py-0.5 font-mono">.env.local.example</code> to{' '}
        <code className="mx-1 rounded bg-neutral-200 px-1 py-0.5 font-mono">.env.local</code> and add your Mapbox token.
      </div>
    );
  }

  return (
    <Map
      ref={setRefs}
      mapboxAccessToken={token}
      initialViewState={initialViewState ?? DEFAULT_VIEW}
      mapStyle={mapStyle ?? 'mapbox://styles/mapbox/standard'}
      style={{ width: '100%', height: '100%' }}
      attributionControl={false}
      onLoad={handleLoad}
      antialias
    >
      {children}
    </Map>
  );
});

export default PatioMap;
