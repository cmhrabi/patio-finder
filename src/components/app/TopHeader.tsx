'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { WeatherChip } from './WeatherChip';
import styles from './TopHeader.module.css';

type Props = {
  patioCount: number;
  region?: string;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
};

const TZ = 'America/Toronto';

const dayLabel = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, weekday: 'short' });
const dateLabel = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, month: 'short', day: 'numeric' });

function startOfTorontoDayUTC(d: Date): Date {
  // Anchor every "day" at 16:00 UTC ≈ noon Toronto, stable across DST.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const [y, m, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day, 16));
}

function isSameTorontoDay(a: Date, b: Date): boolean {
  return (
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(a) ===
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(b)
  );
}

export function TopHeader({ patioCount, region = 'Downtown', selectedDate, onSelectDate }: Props) {
  const today = useMemo(() => startOfTorontoDayUTC(new Date()), []);
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + i);
      out.push(d);
    }
    return out;
  }, [today]);

  return (
    <header className={styles.root}>
      <div className={styles.brand}>
        <Link href="/" className={styles.brandLink} aria-label="Golden Hour — home">
          <Logo size={26} />
        </Link>
        <span className={styles.divider} aria-hidden="true" />
        <span className={['type-eyebrow', styles.region].join(' ')}>
          {region} · {patioCount} Patios
        </span>
      </div>

      <nav className={styles.dates} aria-label="Select date">
        {days.map((d, i) => {
          const selected = isSameTorontoDay(d, selectedDate);
          const top = i === 0 ? 'Today' : dayLabel.format(d);
          const bottom = dateLabel.format(d);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelectDate(d)}
              aria-pressed={selected}
              className={[styles.datePill, selected && styles.datePillActive].filter(Boolean).join(' ')}
            >
              <span className={styles.datePillTop}>{top}</span>
              <span className={styles.datePillBottom}>{bottom}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.right}>
        <WeatherChip />
      </div>
    </header>
  );
}
