import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Eyebrow } from '@/components/Eyebrow';
import { Heading } from '@/components/Heading';
import styles from './privacy.module.css';

export const metadata: Metadata = {
  title: 'Privacy — Golden Hour',
  description:
    'Golden Hour collects no personal data. Favourites stay in your browser.',
};

export default function PrivacyPage() {
  return (
    <main className="bg-[var(--cream)] min-h-screen">
      <LandingNav />

      <article className={styles.root}>
        <header className={styles.header}>
          <Eyebrow accent>The short version</Eyebrow>
          <Heading as="h1" size="display-md">
            Privacy
          </Heading>
        </header>

        <div className={styles.body}>
          <section className={styles.section}>
            <p>
              Golden Hour is a map of Toronto patios and how much sun they get.
              There is no account to create and no sign-up. We do not collect,
              sell, or share personal information about you.
            </p>
          </section>

          <section className={styles.section}>
            <Heading size="display-sm">Favourites</Heading>
            <p>
              When you favourite a patio, that list is saved in your own
              browser&rsquo;s local storage. It never leaves your device and we
              never see it. Clearing your browser data clears your favourites.
            </p>
          </section>

          <section className={styles.section}>
            <Heading size="display-sm">Maps</Heading>
            <p>
              Map tiles are served by{' '}
              <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noreferrer noopener">
                Mapbox
              </a>
              , so loading the map sends them the usual request data (such as
              your IP address) under their privacy policy. We don&rsquo;t ask
              for your location, and the map doesn&rsquo;t track you.
            </p>
          </section>

          <section className={styles.section}>
            <Heading size="display-sm">Patio data</Heading>
            <p>
              The patio and sunlight data on this site describes places, not
              people: coordinates, building shapes, and sun calculations. None
              of it is about you.
            </p>
          </section>

          <p className={styles.updated}>Last updated: 9 August 2026</p>
        </div>
      </article>

      <LandingFooter />
    </main>
  );
}
