'use client';

import type { ReactNode } from 'react';
import Map from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

export type PatioMapProps = {
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom?: number;
    pitch?: number;
    bearing?: number;
  };
  mapStyle?: string;
  children?: ReactNode;
};

const DEFAULT_VIEW = {
  longitude: -79.3832,
  latitude: 43.6532,
  zoom: 12,
};

export default function PatioMap({ initialViewState, mapStyle, children }: PatioMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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
      mapboxAccessToken={token}
      initialViewState={initialViewState ?? DEFAULT_VIEW}
      mapStyle={mapStyle ?? 'mapbox://styles/mapbox/standard'}
      style={{ width: '100%', height: '100%' }}
      antialias
    >
      {children}
    </Map>
  );
}
