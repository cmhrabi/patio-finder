import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Eyebrow } from '@/components/Eyebrow';
import { Heading } from '@/components/Heading';
import { SunRating } from '@/components/SunRating';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import type { Patio } from '@/lib/patios/types';
import styles from './BrightestSix.module.css';

type Props = {
  patios: Array<{ patio: Patio; sunPct: number }>;
};

export function BrightestSix({ patios }: Props) {
  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <Eyebrow accent>Sunny right now</Eyebrow>
          <Heading size="display-md" className={styles.heading}>
            The brightest six.
          </Heading>
        </div>
        <Link href="/map" className={styles.viewAll}>
          View all
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </header>

      <ol className={styles.grid}>
        {patios.slice(0, 6).map((p, i) => (
          <li key={p.patio.id} className={styles.cell}>
            <Card cardStyle="soft" className={styles.card}>
              {p.patio.photo ? (
                <Card.Media>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.patio.photo} alt="" loading="lazy" />
                </Card.Media>
              ) : null}
              <Card.Body>
                <div className={styles.cardTop}>
                  <span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span>
                  <Pill variant="sun">{Math.round(p.sunPct)}% sun</Pill>
                </div>
                <Heading size="display-sm" className={styles.cardName}>
                  {p.patio.name}
                </Heading>
                <div className={styles.cardMeta}>
                  <span className={styles.hood}>{p.patio.hood ?? '—'}</span>
                  <SunRating value={p.sunPct} size={9} hideLabel />
                </div>
              </Card.Body>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
