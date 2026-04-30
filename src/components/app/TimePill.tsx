'use client';

import { Sun } from 'lucide-react';
import styles from './TimePill.module.css';

type Props = {
  /** Localised time string, e.g. "3:30 PM". */
  time: string;
  /** Day label, e.g. "Today", "Fri May 1". */
  day: string;
  /** Click handler — used to snap the scrubber back to the current real time. */
  onReset?: () => void;
};

export function TimePill({ time, day, onReset }: Props) {
  return (
    <button
      type="button"
      className={styles.root}
      onClick={onReset}
      aria-label={`Reset time. Currently showing ${time}, ${day}.`}
      title="Reset to now"
    >
      <Sun size={14} strokeWidth={2.5} aria-hidden="true" />
      <span className={styles.time}>{time}</span>
      <span className={styles.dot} aria-hidden="true">·</span>
      <span className={styles.day}>{day}</span>
    </button>
  );
}
