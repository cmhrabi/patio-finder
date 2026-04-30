import { LandingNav } from '@/components/landing/LandingNav';
import { Hero } from '@/components/landing/Hero';
import { BrightestSix } from '@/components/landing/BrightestSix';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { getDayTimes } from '@/lib/sun/sunPosition';
import { listVenuesFromDb } from '@/lib/patios/db';
import { NEIGHBOURHOODS, type Venue } from '@/lib/patios/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Re-rank every 5 minutes — picks up the next 5-min sample bucket from the
// precomputed series.
export const revalidate = 300;

const TZ = 'America/Toronto';
const TORONTO_CENTRE: [number, number] = [-79.4185, 43.6515];

const eyebrowDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  month: 'long',
  day: 'numeric',
});

const ymdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

type SeriesRow = {
  patio_id: string;
  ts: string;
  sun_fraction: number;
};

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
  const todayYmd = ymdFmt.format(now);
  const supabase = await createSupabaseServerClient();

  const [venues, seriesRes] = await Promise.all([
    listVenuesFromDb(),
    supabase
      .from('patio_sun_series')
      .select('patio_id, ts, sun_fraction')
      .eq('local_date', todayYmd)
      .returns<SeriesRow[]>(),
  ]);

  const dayTimes = getDayTimes(now, TORONTO_CENTRE[1], TORONTO_CENTRE[0]);
  const sunrise = dayTimes.sunrise && !isNaN(dayTimes.sunrise.getTime()) ? dayTimes.sunrise : null;
  const sunset = dayTimes.sunset && !isNaN(dayTimes.sunset.getTime()) ? dayTimes.sunset : null;

  // Rank against "now" inside daylight, solar noon outside it (keeps the page
  // meaningful pre-sunrise / post-sunset).
  const nowMs = now.getTime();
  const inDaylight = sunrise && sunset && nowMs >= sunrise.getTime() && nowMs <= sunset.getTime();
  const rankingMoment =
    inDaylight || !sunrise || !sunset
      ? now
      : new Date(sunrise.getTime() + (sunset.getTime() - sunrise.getTime()) / 2);
  const rankingMs = rankingMoment.getTime();

  // Group rows by patio and find the sample whose ts is closest to the ranking
  // moment. If there's no precomputed data for a patio (cron hasn't run yet,
  // or new patio) it falls out as 0 — surfaced visibly in the BrightestSix list
  // so it's obvious the batch needs a kick.
  const byPatio = new Map<string, SeriesRow[]>();
  for (const r of seriesRes.data ?? []) {
    const arr = byPatio.get(r.patio_id);
    if (arr) arr.push(r);
    else byPatio.set(r.patio_id, [r]);
  }

  // Per-venue sun% = best across the venue's patios from precomputed series.
  const ranked: RankedVenueRow[] = venues
    .map((venue) => {
      let sunPct = 0;
      for (const p of venue.patios) {
        const series = byPatio.get(p.id);
        if (!series || series.length === 0) continue;
        let best = series[0];
        let bestDelta = Math.abs(Date.parse(best.ts) - rankingMs);
        for (let i = 1; i < series.length; i++) {
          const delta = Math.abs(Date.parse(series[i].ts) - rankingMs);
          if (delta < bestDelta) {
            best = series[i];
            bestDelta = delta;
          }
        }
        const pct = Math.max(0, Math.min(1, best.sun_fraction)) * 100;
        if (pct > sunPct) sunPct = pct;
      }
      return { venue, sunPct };
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
