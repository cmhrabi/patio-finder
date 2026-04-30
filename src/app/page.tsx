import { LandingNav } from '@/components/landing/LandingNav';
import { Hero } from '@/components/landing/Hero';
import { BrightestSix } from '@/components/landing/BrightestSix';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { loadStaticBuildings } from '@/lib/buildings/loadStatic';
import { computeSunSnapshotAt } from '@/lib/sun/snapshot';
import { getDayTimes } from '@/lib/sun/sunPosition';
import { listVenuesFromDb } from '@/lib/patios/db';
import { NEIGHBOURHOODS, type Venue } from '@/lib/patios/types';

// Re-rank every 5 minutes — sun position changes meaningfully on that cadence.
export const revalidate = 300;

const TZ = 'America/Toronto';
const TORONTO_CENTRE: [number, number] = [-79.4185, 43.6515];

const eyebrowDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  month: 'long',
  day: 'numeric',
});

function formatDaylight(sunrise: Date | null, sunset: Date | null): string {
  if (!sunrise || !sunset) return '—';
  const ms = sunset.getTime() - sunrise.getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export type RankedVenueRow = { venue: Venue; sunPct: number };

export default async function LandingPage() {
  const now = new Date();
  const [buildings, venues] = await Promise.all([
    loadStaticBuildings(),
    listVenuesFromDb(),
  ]);

  const dayTimes = getDayTimes(now, TORONTO_CENTRE[1], TORONTO_CENTRE[0]);
  const sunrise = dayTimes.sunrise && !isNaN(dayTimes.sunrise.getTime()) ? dayTimes.sunrise : null;
  const sunset = dayTimes.sunset && !isNaN(dayTimes.sunset.getTime()) ? dayTimes.sunset : null;

  const nowMs = now.getTime();
  const inDaylight = sunrise && sunset && nowMs >= sunrise.getTime() && nowMs <= sunset.getTime();
  const rankingMoment =
    inDaylight || !sunrise || !sunset
      ? now
      : new Date(sunrise.getTime() + (sunset.getTime() - sunrise.getTime()) / 2);

  // Per-venue sun% = best across the venue's patios. Real shadow geometry from
  // the static City of Toronto 3D Massing dataset; ISR caches the result for 5 min.
  const ranked: RankedVenueRow[] = venues
    .map((venue) => {
      let best = 0;
      for (const p of venue.patios) {
        const { sunFraction } = computeSunSnapshotAt(p.polygon, buildings, rankingMoment);
        if (sunFraction > best) best = sunFraction;
      }
      return { venue, sunPct: best * 100 };
    })
    .sort((a, b) => b.sunPct - a.sunPct);

  const totalPatios = venues.reduce((n, v) => n + v.patios.length, 0);

  const eyebrow = `Toronto · Live sunlight · ${eyebrowDateFmt.format(now)}`;
  const callouts = ranked.slice(0, 3).map(({ venue, sunPct }) => ({
    name: venue.name,
    pct: sunPct,
  }));

  const hoodsCount = new Set(
    venues.map((v) => v.hood).filter((h): h is (typeof NEIGHBOURHOODS)[number] => Boolean(h)),
  ).size;

  const stats = [
    { value: String(totalPatios), label: 'patios tracked' },
    { value: String(hoodsCount), label: 'neighbourhoods' },
    { value: formatDaylight(sunrise, sunset), label: 'of daylight today' },
  ];

  return (
    <main className="bg-[var(--cream)] min-h-screen">
      <LandingNav />
      <Hero
        eyebrow={eyebrow}
        patioCount={totalPatios}
        callouts={callouts}
        stats={stats}
      />
      <BrightestSix venues={ranked} />
      <LandingFooter />
    </main>
  );
}
