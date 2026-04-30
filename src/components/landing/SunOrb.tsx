import styles from './SunOrb.module.css';

export type OrbCallout = {
  name: string;
  pct: number;
};

type Props = {
  /** Top-3 patios shown as floating callouts pinned around the orb. */
  callouts: OrbCallout[];
};

/**
 * Big half-sun-half-shade illustration with three live patio callouts pinned to it.
 * The orb itself is decorative; the callouts are real (top-3 ranked patios).
 */
export function SunOrb({ callouts }: Props) {
  // Three fixed positions on the orb — the visual is decorative so we don't try
  // to map percentage → actual position. Order matches the mockup:
  //  - top-right, mid-left, lower-right.
  const positions: Array<{ x: string; y: string }> = [
    { x: '74%', y: '8%' },
    { x: '12%', y: '38%' },
    { x: '78%', y: '70%' },
  ];

  return (
    <div className={styles.wrap} aria-hidden="true">
      <div className={styles.orb} />
      <div className={styles.glow} />
      {callouts.slice(0, 3).map((c, i) => {
        const pos = positions[i];
        if (!pos) return null;
        return (
          <div
            key={c.name}
            className={styles.callout}
            style={{ left: pos.x, top: pos.y }}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.calloutText}>
              <span className={styles.name}>{c.name}</span>
              <span className={styles.pct}>
                {Math.round(c.pct)}% <span className={styles.pctLabel}>sun</span>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
