import { LandingNav } from '@/components/landing/LandingNav';
import { Hero } from '@/components/landing/Hero';
import { BrightestSix } from '@/components/landing/BrightestSix';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { loadStaticBuildings } from '@/lib/buildings/loadStatic';
import { computeSunSnapshotAt } from '@/lib/sun/snapshot';
import { getDayTimes } from '@/lib/sun/sunPosition';
import { listPatiosFromDb } from '@/lib/patios/db';
import { NEIGHBOURHOODS } from '@/lib/patios/types';

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

export default async function LandingPage() {
  const now = new Date();
  const [buildings, patios] = await Promise.all([
    loadStaticBuildings(),
    listPatiosFromDb(),
  ]);

  // Sunrise / sunset / daylight for the eyebrow + stats are derived from the
  // city centre (good enough for one number — coords vary by < 1 second across
  // central Toronto).
  const dayTimes = getDayTimes(now, TORONTO_CENTRE[1], TORONTO_CENTRE[0]);
  const sunrise = dayTimes.sunrise && !isNaN(dayTimes.sunrise.getTime()) ? dayTimes.sunrise : null;
  const sunset = dayTimes.sunset && !isNaN(dayTimes.sunset.getTime()) ? dayTimes.sunset : null;

  // Decide the moment we rank against:
  //   - between sunrise and sunset → use "now"
  //   - otherwise → use solar noon (so the page still has a meaningful ranking
  //     before sunrise / after sunset).
  const nowMs = now.getTime();
  const inDaylight = sunrise && sunset && nowMs >= sunrise.getTime() && nowMs <= sunset.getTime();
  const rankingMoment =
    inDaylight || !sunrise || !sunset
      ? now
      : new Date(sunrise.getTime() + (sunset.getTime() - sunrise.getTime()) / 2);

  // Live ranking: real shadow geometry against the static City of Toronto
  // 3D Massing dataset. Each snapshot is one shadow union per patio (~50ms each
  // in practice). The page is ISR (revalidate=300) so this runs once per 5 min.
  const ranked = patios
    .map((patio) => {
      const { sunFraction } = computeSunSnapshotAt(patio.polygon, buildings, rankingMoment);
      return { patio, sunPct: sunFraction * 100 };
    })
    .sort((a, b) => b.sunPct - a.sunPct);

  const eyebrow = `Toronto · Live sunlight · ${eyebrowDateFmt.format(now)}`;
  const callouts = ranked.slice(0, 3).map(({ patio, sunPct }) => ({
    name: patio.name,
    pct: sunPct,
  }));

  const hoodsCount = new Set(
    patios.map((p) => p.hood).filter((h): h is (typeof NEIGHBOURHOODS)[number] => Boolean(h)),
  ).size;

  const stats = [
    { value: String(patios.length), label: 'patios tracked' },
    { value: String(hoodsCount), label: 'neighbourhoods' },
    { value: formatDaylight(sunrise, sunset), label: 'of daylight today' },
  ];

  return (
    <main className="bg-[var(--cream)] min-h-screen">
      <LandingNav />
      <Hero
        eyebrow={eyebrow}
        patioCount={patios.length}
        callouts={callouts}
        stats={stats}
      />
      <BrightestSix patios={ranked} />
      <LandingFooter />
    </main>
  );
}
