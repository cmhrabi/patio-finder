'use client';

import { Sun } from 'lucide-react';
import styles from './TimePill.module.css';

type Props = {
  /** Localised time string, e.g. "3:30 PM". */
  time: string;
  /** Day label, e.g. "Today", "Fri May 1". */
  day: string;
};

export function TimePill({ time, day }: Props) {
  return (
    <div className={styles.root} role="status" aria-live="polite">
      <Sun size={14} strokeWidth={2.5} aria-hidden="true" />
      <span className={styles.time}>{time}</span>
      <span className={styles.dot} aria-hidden="true">·</span>
      <span className={styles.day}>{day}</span>
    </div>
  );
}
