'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import styles from './TimelineBar.module.css';

type Props = {
  sunrise: Date | null;
  sunset: Date | null;
  /** Current scrub time as ms-since-epoch. Clamped to [sunrise, sunset]. */
  currentMs: number;
  onChange: (ms: number) => void;
  /** Optional callback when the user releases the scrubber (for caching/expensive recomputes). */
  onCommit?: (ms: number) => void;
  disabled?: boolean;
};

const TZ = 'America/Toronto';

const timeFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const hourFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  hour: '2-digit',
  hour12: false,
});

function minute(d: Date, h: number, m = 0): Date {
  // Construct a Date at the given Toronto local hour:minute on the same day as d.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const [y, mo, day] = ymd.split('-').map(Number);
  // Toronto is UTC-4 (EDT) in summer, UTC-5 (EST) in winter. Do not assume — derive
  // by querying offset for that local time.
  const utcGuess = new Date(Date.UTC(y, mo - 1, day, h, m));
  const tzString = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    hour: '2-digit',
    hour12: false,
  }).format(utcGuess);
  const observedHour = Number(tzString);
  const diff = observedHour - h;
  return new Date(utcGuess.getTime() - diff * 60 * 60 * 1000);
}

export function TimelineBar({ sunrise, sunset, currentMs, onChange, onCommit, disabled }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [playing, setPlaying] = useState(false);

  const start = sunrise?.getTime() ?? 0;
  const end = sunset?.getTime() ?? 0;
  const range = Math.max(1, end - start);

  const safeMs = Math.min(end, Math.max(start, currentMs));
  const t = sunrise && sunset ? (safeMs - start) / range : 0;

  const ticks = useMemo(() => {
    if (!sunrise || !sunset) return [] as { label: string; t: number }[];
    const out: { label: string; t: number }[] = [];
    // Show hour ticks at 6:00, 10:00, 13:00, 17:00, 21:00 (or whichever fall inside the range).
    const TICK_HOURS = [6, 10, 13, 17, 21];
    for (const h of TICK_HOURS) {
      const tickDate = minute(sunrise, h);
      if (tickDate.getTime() < start || tickDate.getTime() > end) continue;
      out.push({
        label: `${hourFmt.format(tickDate)}:00`,
        t: (tickDate.getTime() - start) / range,
      });
    }
    return out;
  }, [sunrise, sunset, start, end, range]);

  const setFromClientX = useCallback(
    (clientX: number, commit = false) => {
      if (!sunrise || !sunset) return;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const ms = start + ratio * range;
      onChange(ms);
      if (commit) onCommit?.(ms);
    },
    [sunrise, sunset, start, range, onChange, onCommit],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    setPlaying(false);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setFromClientX(e.clientX, true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!sunrise || !sunset) return;
    const STEP_MS = 5 * 60 * 1000;
    const BIG_STEP_MS = 30 * 60 * 1000;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(Math.max(start, safeMs - (e.shiftKey ? BIG_STEP_MS : STEP_MS)));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(Math.min(end, safeMs + (e.shiftKey ? BIG_STEP_MS : STEP_MS)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(start);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(end);
    }
  };

  // Play: advance ~3min every 200ms (full sunrise→sunset run in ~56s for a 14h day).
  useEffect(() => {
    if (!playing || !sunrise || !sunset) return;
    const STEP_MS = 3 * 60 * 1000;
    const id = window.setInterval(() => {
      onChange(Math.min(end, safeMs + STEP_MS));
      if (safeMs + STEP_MS >= end) setPlaying(false);
    }, 200);
    return () => window.clearInterval(id);
  }, [playing, sunrise, sunset, safeMs, end, onChange]);

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.play}
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Pause' : 'Play through the day'}
        disabled={disabled || !sunrise || !sunset}
      >
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>

      <div className={styles.bookend}>
        <span className={['type-eyebrow', styles.bookendLabel].join(' ')}>Sunrise</span>
        <span className={styles.bookendValue}>{sunrise ? timeFmt.format(sunrise) : '—'}</span>
      </div>

      <div className={styles.trackWrap}>
        <div
          ref={trackRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label="Time of day"
          aria-valuemin={start}
          aria-valuemax={end}
          aria-valuenow={safeMs}
          aria-disabled={disabled || !sunrise || !sunset}
          aria-valuetext={sunrise && sunset ? timeFmt.format(new Date(safeMs)) : undefined}
          className={[styles.track, disabled && styles.trackDisabled].filter(Boolean).join(' ')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <div className={styles.gradient} aria-hidden="true" />
          {ticks.map((tk) => (
            <span key={tk.label} className={styles.tickLabel} style={{ left: `${tk.t * 100}%` }}>
              {tk.label}
            </span>
          ))}
          <div className={styles.thumb} style={{ left: `${t * 100}%` }} aria-hidden="true" />
        </div>
      </div>

      <div className={[styles.bookend, styles.bookendRight].join(' ')}>
        <span className={['type-eyebrow', styles.bookendLabel].join(' ')}>Sunset</span>
        <span className={styles.bookendValue}>{sunset ? timeFmt.format(sunset) : '—'}</span>
      </div>
    </div>
  );
}
