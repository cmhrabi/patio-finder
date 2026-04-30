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
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
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

/** Short editorial phrase for the chip — picks personality over precision. */
function vibe(condition: WeatherCondition, temp: number): string {
  switch (condition) {
    case 'storm':
      return 'wild out there';
    case 'rain':
      return 'soggy';
    case 'drizzle':
      return 'spitting';
    case 'snow':
      return 'snowy';
    case 'fog':
      return 'moody';
    case 'clear':
      if (temp >= 22) return 'patio weather';
      if (temp >= 14) return 'sun’s out';
      if (temp >= 4) return 'crisp & clear';
      return 'bright but cold';
    case 'partly-cloudy':
      if (temp >= 18) return 'patio-friendly';
      if (temp >= 8) return 'some sun';
      return 'in & out';
    case 'cloudy':
      if (temp >= 14) return 'cosy grey';
      return 'grey out';
    default:
      return '';
  }
}

export function WeatherChip() {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const reducedMotion = usePrefersReducedMotion();

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
    return <div className={[styles.root, styles.placeholder].join(' ')} aria-hidden="true" />;
  }

  const condition = codeToCondition(snapshot.weatherCode);
  const Icon = ICONS[condition];
  const iconColor = ICON_COLOUR[condition];
  const phrase = vibe(condition, snapshot.temp);
  const animate = !reducedMotion;

  return (
    <div
      className={[styles.root, animate ? styles[`anim_${condition.replace('-', '_')}`] : null]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-label={`Toronto: ${Math.round(snapshot.temp)}°C, feels like ${Math.round(snapshot.feelsLike)}°C, ${condition.replace('-', ' ')}`}
      style={{ ['--w-color' as string]: iconColor }}
    >
      <span className={styles.badge} aria-hidden="true">
        <Icon size={16} strokeWidth={2.25} className={styles.icon} style={{ color: iconColor }} />
      </span>
      <span className={styles.stack}>
        <span className={styles.vibe}>{phrase || condition.replace('-', ' ')}</span>
        <span className={styles.dataRow}>
          <span className={styles.temp}>{Math.round(snapshot.temp)}°</span>
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <span className={styles.feels}>
            feels {Math.round(snapshot.feelsLike)}°
          </span>
        </span>
      </span>
    </div>
  );
}
