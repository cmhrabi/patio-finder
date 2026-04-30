'use client';

import { useMemo } from 'react';
import { ArrowRight, Sun, X } from 'lucide-react';
import { Eyebrow } from '@/components/Eyebrow';
import { Heading } from '@/components/Heading';
import { Pill } from '@/components/Pill';
import { Sparkline } from '@/components/Sparkline';
import { Star } from '@/components/Star';
import type { Venue } from '@/lib/patios/types';
import type { SunSample } from '@/lib/sun/types';
import styles from './VenueDetailsPanel.module.css';

const TZ = 'America/Toronto';

const peakTimeFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dayKeyFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
});

function formatTodayHours(hours: Venue['hours']): string | null {
  if (!hours) return null;
  const key = dayKeyFmt.format(new Date()).toLowerCase();
  const slots = hours[key];
  if (!slots || slots.length === 0) return null;
  return slots.map(([open, close]) => `${open} – ${close}`).join(', ');
}

// Placeholder until the `taps` table is wired through to the frontend. The
// current shape mirrors the DB columns so swapping in real data later is a
// drop-in change.
type MockTap = { name: string; brewery: string };
const MOCK_TAPS: MockTap[] = [
  { name: 'Witchshark IPA', brewery: 'Bellwoods' },
  { name: 'Shumei Pilsner', brewery: 'Blood Brothers' },
  { name: 'Otsukaresama Lager', brewery: 'Godspeed' },
  { name: 'Saison', brewery: 'Burdock' },
  { name: 'Guinness', brewery: 'Guinness' },
];

type Props = {
  venue: Venue;
  /** 0..100, best patio's sun% at the active scrub time. */
  sunPct: number | null;
  /** All sun samples for the venue's best patio across the day. Drives the sparkline. */
  series: SunSample[];
  /** Active scrub time (epoch ms). Used to highlight the current dot on the sparkline. */
  currentMs: number;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onClose: () => void;
};

export function VenueDetailsPanel({
  venue,
  sunPct,
  series,
  currentMs,
  isFavourite,
  onToggleFavourite,
  onClose,
}: Props) {
  // Hood eyebrow: prefer the canonical hood (matches the filter UI), else the
  // raw DB string, else nothing — no point shouting "UNDEFINED".
  const eyebrow = (venue.hood ?? venue.hoodLabel ?? '').toUpperCase();

  // Reduce the dense per-minute series to ~48 points so the sparkline stroke
  // is smooth without the path string ballooning.
  const { sparklineData, currentIndex, peakLabel } = useMemo(() => {
    if (series.length === 0) {
      return { sparklineData: [] as number[], currentIndex: undefined, peakLabel: null as string | null };
    }
    const TARGET = 48;
    const step = Math.max(1, Math.floor(series.length / TARGET));
    const sampled: SunSample[] = [];
    for (let i = 0; i < series.length; i += step) sampled.push(series[i]);
    if (sampled[sampled.length - 1] !== series[series.length - 1]) {
      sampled.push(series[series.length - 1]);
    }
    const data = sampled.map((s) => s.sunFraction * 100);

    // Closest sampled point to the active scrub time.
    let bestIdx = 0;
    let bestDelta = Math.abs(sampled[0].time.getTime() - currentMs);
    for (let i = 1; i < sampled.length; i++) {
      const d = Math.abs(sampled[i].time.getTime() - currentMs);
      if (d < bestDelta) {
        bestDelta = d;
        bestIdx = i;
      }
    }

    // Peak time across the *full-resolution* series so we report it accurately.
    let peak = series[0];
    for (let i = 1; i < series.length; i++) {
      if (series[i].sunFraction > peak.sunFraction) peak = series[i];
    }
    const label = peak.sunFraction > 0 ? peakTimeFmt.format(peak.time) : null;

    return { sparklineData: data, currentIndex: bestIdx, peakLabel: label };
  }, [series, currentMs]);

  const directionsHref = useMemo(() => {
    const dest = venue.address?.trim()
      ? encodeURIComponent(venue.address)
      : `${venue.lat},${venue.lng}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  }, [venue.address, venue.lat, venue.lng]);

  const sunPctLabel = sunPct == null ? '— sun' : `${Math.round(sunPct)}% sun`;
  const openLabel = venue.openNow ? 'open now' : venue.openNow === false ? 'closed' : null;
  const hoursToday = formatTodayHours(venue.hours);

  return (
    <section className={styles.root} aria-label={`${venue.name} details`}>
      <div className={styles.media}>
        {venue.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venue.photo} alt="" className={styles.image} />
        ) : (
          <div className={styles.imagePlaceholder} aria-hidden="true" />
        )}
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close details">
          <X size={18} aria-hidden="true" />
        </button>
        <div className={styles.statusPill}>
          <Pill leadingIcon={<Sun size={12} />}>
            <span className={styles.statusValue}>{sunPctLabel}</span>
            {openLabel ? (
              <>
                <span className={styles.statusDivider} aria-hidden="true">·</span>
                <span className={styles.statusOpen}>{openLabel}</span>
              </>
            ) : null}
          </Pill>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <div className={styles.titleMain}>
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <Heading size="display-md" className={styles.heading}>
              {venue.name}
            </Heading>
            {venue.address ? (
              <p className={['type-body-md', styles.address].join(' ')}>{venue.address}</p>
            ) : null}
          </div>
          <Star
            pressed={isFavourite}
            onChange={onToggleFavourite}
            size={22}
            className={styles.fav}
          />
        </div>

        {venue.description ? (
          <p className={['type-body-md', styles.description].join(' ')}>{venue.description}</p>
        ) : null}

        {sparklineData.length > 1 ? (
          <div className={styles.forecast}>
            <div className={styles.forecastHeader}>
              <Eyebrow>Sun forecast</Eyebrow>
              {peakLabel ? (
                <span className={styles.peak}>
                  <span className={styles.peakLabel}>peak</span>
                  <span className={styles.peakTime}>{peakLabel}</span>
                </span>
              ) : null}
            </div>
            <Sparkline
              data={sparklineData}
              currentIndex={currentIndex}
              width={320}
              height={72}
              flush
              aria-label="Sun coverage across the day"
              className={styles.sparkline}
            />
          </div>
        ) : null}

        {hoursToday ? (
          <div className={styles.section}>
            <Eyebrow>Hours today</Eyebrow>
            <p className={styles.hours}>{hoursToday}</p>
          </div>
        ) : null}

        <div className={styles.section}>
          <Eyebrow>On tap</Eyebrow>
          <ul className={styles.tapList}>
            {MOCK_TAPS.map((t) => (
              <li key={`${t.name}-${t.brewery}`} className={styles.tapItem}>
                <span className={styles.tapName}>{t.name}</span>
                <span className={styles.tapBrewery}>{t.brewery}</span>
              </li>
            ))}
          </ul>
        </div>

        <a
          href={directionsHref}
          target="_blank"
          rel="noreferrer noopener"
          className={styles.cta}
        >
          <span className={styles.ctaLabel}>Get directions</span>
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
