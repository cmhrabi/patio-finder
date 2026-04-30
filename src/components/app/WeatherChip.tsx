'use client';

import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { codeToCondition, type WeatherCondition, type WeatherSnapshot } from '@/lib/weather/openMeteo';
import styles from './WeatherChip.module.css';

const ICONS: Record<WeatherCondition, LucideIcon> = {
  clear: Sun,
  'partly-cloudy': CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
  unknown: Cloud,
};

const ICON_COLOUR: Record<WeatherCondition, string> = {
  clear: 'var(--sun-300)',
  'partly-cloudy': 'var(--sun-200)',
  cloudy: 'var(--map-text-mute)',
  fog: 'var(--map-text-mute)',
  drizzle: 'var(--shade-200)',
  rain: 'var(--shade-200)',
  snow: 'var(--map-text)',
  storm: 'var(--accent)',
  unknown: 'var(--map-text-mute)',
};

export function WeatherChip() {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/weather')
      .then(async (r) => {
        if (!r.ok) throw new Error(`weather ${r.status}`);
        return (await r.json()) as WeatherSnapshot;
      })
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        // Silently degrade — the chip just won't render.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!snapshot) {
    // Reserve space so the header layout doesn't reflow when data arrives.
    return <div className={[styles.root, styles.placeholder].join(' ')} aria-hidden="true" />;
  }

  const condition = codeToCondition(snapshot.weatherCode);
  const Icon = ICONS[condition];
  const iconColor = ICON_COLOUR[condition];

  return (
    <div
      className={styles.root}
      role="status"
      aria-label={`Toronto: ${Math.round(snapshot.temp)}°C, feels like ${Math.round(snapshot.feelsLike)}°C, ${condition.replace('-', ' ')}`}
    >
      <Icon size={14} strokeWidth={2.25} aria-hidden="true" style={{ color: iconColor }} />
      <span className={styles.temp}>{Math.round(snapshot.temp)}°</span>
      <span className={styles.dot} aria-hidden="true">
        ·
      </span>
      <span className={styles.feels}>
        feels {Math.round(snapshot.feelsLike)}°
      </span>
    </div>
  );
}
