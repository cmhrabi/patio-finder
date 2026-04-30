'use client';

import { Crosshair, Minus, Plus } from 'lucide-react';
import { useMap } from 'react-map-gl/mapbox';
import styles from './MapControls.module.css';

type Props = {
  /** Called when the user clicks the recenter button. AppShell wires this to flyToOverview. */
  onRecenter: () => void;
  /** Hide the recenter button when nothing is selected (no point flying back to where we already are). */
  showRecenter: boolean;
};

/**
 * Vertical stack of zoom + recenter buttons, styled to match the dark glass
 * panels. Mounted inside <PatioMap> so we can grab the map via useMap().
 */
export function MapControls({ onRecenter, showRecenter }: Props) {
  const { current } = useMap();
  const map = current?.getMap();

  return (
    <div className={styles.stack} aria-label="Map controls">
      <button
        type="button"
        className={styles.btn}
        onClick={() => map?.zoomIn({ duration: 200 })}
        aria-label="Zoom in"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
      <div className={styles.divider} aria-hidden="true" />
      <button
        type="button"
        className={styles.btn}
        onClick={() => map?.zoomOut({ duration: 200 })}
        aria-label="Zoom out"
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      {showRecenter ? (
        <>
          <div className={styles.divider} aria-hidden="true" />
          <button
            type="button"
            className={styles.btn}
            onClick={onRecenter}
            aria-label="Recenter map"
          >
            <Crosshair size={16} aria-hidden="true" />
          </button>
        </>
      ) : null}
    </div>
  );
}

/**
 * Tiny static credit pill so we still attribute Mapbox + OSM after disabling
 * the default attribution control. Sits in the bottom-right above the timeline.
 */
export function MapAttribution() {
  return (
    <div className={styles.attribution} aria-hidden="true">
      ©{' '}
      <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer noopener">
        Mapbox
      </a>{' '}
      ·{' '}
      <a href="https://www.openstreetmap.org/about/" target="_blank" rel="noreferrer noopener">
        OSM
      </a>
    </div>
  );
}
