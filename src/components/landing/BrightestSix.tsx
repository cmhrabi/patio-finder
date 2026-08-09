import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Eyebrow } from '@/components/Eyebrow';
import { Heading } from '@/components/Heading';
import { SunRating } from '@/components/SunRating';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import type { Venue } from '@/lib/patios/types';
import styles from './BrightestSix.module.css';

type Props = {
  venues: Array<{ venue: Venue; sunPct: number }>;
};

export function BrightestSix({ venues }: Props) {
  return (
    <section id="brightest-six" className={styles.root}>
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
        {venues.slice(0, 6).map((v, i) => (
          <li key={v.venue.id} className={styles.cell}>
            <Card cardStyle="soft" className={styles.card}>
              {v.venue.photo ? (
                <Card.Media>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.venue.photo} alt="" loading="lazy" />
                </Card.Media>
              ) : null}
              <Card.Body>
                <div className={styles.cardTop}>
                  <span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span>
                  <Pill variant="sun">{Math.round(v.sunPct)}% sun</Pill>
                </div>
                <Heading size="display-sm" className={styles.cardName}>
                  {v.venue.name}
                </Heading>
                <div className={styles.cardMeta}>
                  <span className={styles.hood}>{v.venue.hood ?? '—'}</span>
                  <SunRating value={v.sunPct} size={9} hideLabel />
                </div>
              </Card.Body>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
