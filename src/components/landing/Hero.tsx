import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Eyebrow } from '@/components/Eyebrow';
import { Heading } from '@/components/Heading';
import { SunOrb, type OrbCallout } from './SunOrb';
import styles from './Hero.module.css';

type Stat = { value: string; label: string };

type Props = {
  eyebrow: string;
  patioCount: number;
  callouts: OrbCallout[];
  stats: Stat[];
};

export function Hero({ eyebrow, patioCount, callouts, stats }: Props) {
  return (
    <section className={styles.root}>
      <div className={styles.copy}>
        <Eyebrow accent>{eyebrow}</Eyebrow>
        <Heading size="display-xl" className={styles.headline}>
          Chase the sun across<br />
          Toronto&apos;s patios.
        </Heading>
        <p className={['type-body-lg', styles.lede].join(' ')}>
          Real-time shadows, real-time patios. Golden Hour tracks where the light is
          falling right now — so you know which pint to point yourself at.
        </p>

        <div className={styles.ctas}>
          <Link href="/map" className={styles.primary}>
            Open the live map
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/map" className={styles.secondary}>
            Browse all {patioCount} patios
          </Link>
        </div>

        <dl className={styles.stats}>
          {stats.map((s) => (
            <div key={s.label} className={styles.stat}>
              <dt className={styles.statValue}>{s.value}</dt>
              <dd className={['type-body-sm', styles.statLabel].join(' ')}>{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={styles.visual}>
        <SunOrb callouts={callouts} />
      </div>
    </section>
  );
}
