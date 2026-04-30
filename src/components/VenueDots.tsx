'use client';

import { useId } from 'react';
import { Marker } from 'react-map-gl/mapbox';
import type { Venue } from '@/lib/patios/types';
import styles from './VenueDots.module.css';

const SUN_COLOUR = '#ffeb3b';
const SHADE_COLOUR = '#1a1814';
const PENDING_COLOUR = '#586477';
const STROKE_COLOUR = '#0a0a0a';

type Props = {
  venues: Venue[];
  /** venue-id → 0..100 best sun across that venue's patios. Drives the dot's split. */
  sunPctByVenue: Record<string, number | null | undefined>;
  /** Skipped: we don't render a dot for the active venue — its polygons take over. */
  activeVenueId: string | null;
  onSelectVenue?: (id: string) => void;
  /** Pixel diameter of each dot. */
  size?: number;
};

/**
 * One marker per venue, rendered as an SVG circle that's split vertically:
 *   left portion = sunlit (yellow), proportional to sunPct
 *   right portion = shaded (near-black), the remainder
 *
 * Uses react-map-gl `<Marker>` rather than a Mapbox circle layer because the
 * partial-fill effect can't be expressed with circle-paint properties — it
 * needs an SVG `clipPath`. Marker count is small (~tens of venues), so the
 * DOM cost is negligible.
 */
export function VenueDots({
  venues,
  sunPctByVenue,
  activeVenueId,
  onSelectVenue,
  size = 18,
}: Props) {
  return (
    <>
      {venues.map((v) => {
        if (v.id === activeVenueId) return null;
        const raw = sunPctByVenue[v.id];
        const pct = typeof raw === 'number' ? Math.max(0, Math.min(100, raw)) : null;
        return (
          <Marker
            key={v.id}
            longitude={v.lng}
            latitude={v.lat}
            anchor="center"
            // Stop the click bubbling up to the map's own click handler.
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelectVenue?.(v.id);
            }}
          >
            <SplitDot pct={pct} size={size} title={v.name} />
          </Marker>
        );
      })}
    </>
  );
}

function SplitDot({ pct, size, title }: { pct: number | null; size: number; title: string }) {
  const reactId = useId();
  const clipId = `sun-clip-${reactId}`;
  // viewBox 0..100 keeps the geometry self-similar regardless of `size`.
  const sunWidth = pct ?? 0;
  const ariaLabel = pct == null ? `${title}: sun coverage pending` : `${title}: ${Math.round(pct)} percent sun`;

  return (
    <span
      className={styles.dot}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        aria-hidden="true"
        className={styles.svg}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={sunWidth} height={100} />
          </clipPath>
        </defs>
        {/* Shade base: fills the whole disc, gets covered on the left by the
            sun layer up to the clip-rect's right edge. */}
        <circle cx={50} cy={50} r={47} fill={pct == null ? PENDING_COLOUR : SHADE_COLOUR} />
        {/* Sun overlay: only the clipped left portion shows. */}
        {pct != null ? (
          <circle cx={50} cy={50} r={47} fill={SUN_COLOUR} clipPath={`url(#${clipId})`} />
        ) : null}
        {/* Border on top so the split line doesn't poke past the disc edge. */}
        <circle cx={50} cy={50} r={47} fill="none" stroke={STROKE_COLOUR} strokeWidth={3} />
      </svg>
    </span>
  );
}
