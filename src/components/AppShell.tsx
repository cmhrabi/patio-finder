'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';
import PatioMap from './PatioMap';
import { VenuesLayer } from './VenuesLayer';
import { SunLightController } from './SunLightController';
import { TopHeader } from './app/TopHeader';
import { TimePill } from './app/TimePill';
import { TimelineBar } from './app/TimelineBar';
import { MapAttribution, MapControls } from './app/MapControls';
import {
  RankingPanel,
  emptyFilters,
  type Filters,
  type RankingTab,
  type RankedVenue,
} from './app/RankingPanel';
import { VenueDetailsPanel } from './app/VenueDetailsPanel';
import { useFavourites } from '@/hooks/useFavourites';
import { clearLegacyPatioCache, fetchVenues } from '@/lib/patios/storage';
import type { Venue } from '@/lib/patios/types';
import { getDayTimes } from '@/lib/sun/sunPosition';
import type { LngLat, SunSample } from '@/lib/sun/types';
import type { SunSeriesResponse } from '@/app/api/sun-series/route';
import styles from './AppShell.module.css';

// Centred on Trinity Bellwoods/Ossington — fits the cluster of seed patios.
// Flat top-down framing while no patio is selected; tilts on selection.
const DOWNTOWN_VIEW = {
  longitude: -79.4185,
  latitude: 43.6515,
  zoom: 13.6,
  pitch: 0,
  bearing: 0,
};

const FOCUSED_PITCH = 50;
const FOCUSED_BEARING = -16;

const TZ = 'America/Toronto';

const dayLabelFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function dayAnchorUTC(d: Date): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const [y, m, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day, 16));
}

function isSameTorontoDay(a: Date, b: Date): boolean {
  return (
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(a) ===
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(b)
  );
}

/** Time-of-day in ms since midnight (Toronto). */
function torontoTimeOfDayMs(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  const h = Number(parts.hour ?? 0);
  const m = Number(parts.minute ?? 0);
  const s = Number(parts.second ?? 0);
  return ((h * 60 + m) * 60 + s) * 1000;
}

/** Construct a Date at the same Toronto time-of-day as `time` but on `day`. */
function setSameTimeOfDay(day: Date, time: Date): Date {
  const offset = torontoTimeOfDayMs(time);
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(day);
  const [y, m, d] = ymd.split('-').map(Number);
  const utcMidnightGuess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const obs = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hour: '2-digit', hour12: false })
      .format(utcMidnightGuess),
  );
  const torontoMidnightUtc = new Date(utcMidnightGuess.getTime() - obs * 60 * 60 * 1000);
  return new Date(torontoMidnightUtc.getTime() + offset);
}

const REPRESENTATIVE_POINT: LngLat = [DOWNTOWN_VIEW.longitude, DOWNTOWN_VIEW.latitude];

const ymdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export default function AppShell() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [seriesByPatio, setSeriesByPatio] = useState<Record<string, SunSample[]>>({});
  const [activeVenueId, setActiveVenueId] = useState<string | null>(null);
  const [tab, setTab] = useState<RankingTab>('ranking');
  const [filters, setFilters] = useState<Filters>(() => emptyFilters());
  const [panelOpen, setPanelOpen] = useState(true);
  const [date, setDate] = useState<Date>(() => dayAnchorUTC(new Date()));
  /** Absolute scrub time, ms-since-epoch. Defaults to "now" on the selected day. */
  const [currentMs, setCurrentMs] = useState<number>(() => Date.now());

  const { favourites, toggle: toggleFavourite } = useFavourites();
  const mapRef = useRef<MapRef | null>(null);

  // Hydrate venues from the DB. Also wipe the legacy localStorage cache from
  // the pre-DB DrawControl flow.
  useEffect(() => {
    clearLegacyPatioCache();
    let cancelled = false;
    void fetchVenues()
      .then((next) => {
        if (!cancelled) setVenues(next);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load venues:', e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch the precomputed sun-fraction series for the selected date. Server
  // returns ISO strings for ts; convert to Date once here so downstream memos
  // can do arithmetic. Missing rows → empty record → UI shows "—".
  useEffect(() => {
    const ymd = ymdFmt.format(date);
    let cancelled = false;
    void fetch(`/api/sun-series?date=${ymd}`, { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<SunSeriesResponse>) : null))
      .then((body) => {
        if (cancelled || !body) return;
        const out: Record<string, SunSample[]> = {};
        for (const [patioId, samples] of Object.entries(body.byPatioId)) {
          out[patioId] = samples.map((s) => ({
            time: new Date(s.time),
            minutesFromSunrise: s.minutesFromSunrise,
            azimuthDeg: s.azimuthDeg,
            altitudeDeg: s.altitudeDeg,
            sunFraction: s.sunFraction,
          }));
        }
        setSeriesByPatio(out);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load sun series:', e);
        if (!cancelled) setSeriesByPatio({});
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const dayTimes = useMemo(
    () => getDayTimes(date, REPRESENTATIVE_POINT[1], REPRESENTATIVE_POINT[0]),
    [date],
  );
  const sunrise = dayTimes.sunrise && !isNaN(dayTimes.sunrise.getTime()) ? dayTimes.sunrise : null;
  const sunset = dayTimes.sunset && !isNaN(dayTimes.sunset.getTime()) ? dayTimes.sunset : null;

  const basemapLightPreset = useMemo<'dawn' | 'day' | 'dusk'>(() => {
    if (!sunrise || !sunset) return 'day';
    const TRANSITION_MS = 75 * 60 * 1000;
    if (currentMs < sunrise.getTime() + TRANSITION_MS) return 'dawn';
    if (currentMs > sunset.getTime() - TRANSITION_MS) return 'dusk';
    return 'day';
  }, [currentMs, sunrise, sunset]);

  useEffect(() => {
    if (!sunrise || !sunset) return;
    setCurrentMs((prev) => {
      if (prev >= sunrise.getTime() && prev <= sunset.getTime()) return prev;
      const noon = sunrise.getTime() + (sunset.getTime() - sunrise.getTime()) / 2;
      return noon;
    });
  }, [sunrise, sunset]);

  // For each patio, find the sample closest to currentMs and convert sunFraction → 0..100.
  const sunPctByPatio = useMemo<Record<string, number | null>>(() => {
    const out: Record<string, number | null> = {};
    for (const v of venues) {
      for (const p of v.patios) {
        const series = seriesByPatio[p.id];
        if (!series || series.length === 0) {
          out[p.id] = null;
          continue;
        }
        let best = series[0];
        let bestDelta = Math.abs(best.time.getTime() - currentMs);
        for (let i = 1; i < series.length; i++) {
          const delta = Math.abs(series[i].time.getTime() - currentMs);
          if (delta < bestDelta) {
            best = series[i];
            bestDelta = delta;
          }
        }
        out[p.id] = best.sunFraction * 100;
      }
    }
    return out;
  }, [venues, seriesByPatio, currentMs]);

  // Per-venue sun% — the sunniest of the venue's patios. Drives the dot colour
  // on the map and the ranking percentage in the list.
  const sunPctByVenue = useMemo<Record<string, number | null>>(() => {
    const out: Record<string, number | null> = {};
    for (const v of venues) {
      let best: number | null = null;
      for (const p of v.patios) {
        const pct = sunPctByPatio[p.id];
        if (pct == null) continue;
        if (best == null || pct > best) best = pct;
      }
      out[v.id] = best;
    }
    return out;
  }, [venues, sunPctByPatio]);

  const activeVenue = useMemo(
    () => (activeVenueId ? venues.find((v) => v.id === activeVenueId) ?? null : null),
    [activeVenueId, venues],
  );

  // For the details panel sparkline: the active venue's best-overall patio
  // (the one with the highest *peak* sun across the day) carries the most
  // signal, so its full-day series is what we plot.
  const activeVenueSeries = useMemo<SunSample[]>(() => {
    if (!activeVenue) return [];
    let best: SunSample[] = [];
    let bestPeak = -1;
    for (const p of activeVenue.patios) {
      const series = seriesByPatio[p.id];
      if (!series || series.length === 0) continue;
      let peak = 0;
      for (const s of series) if (s.sunFraction > peak) peak = s.sunFraction;
      if (peak > bestPeak) {
        bestPeak = peak;
        best = series;
      }
    }
    return best;
  }, [activeVenue, seriesByPatio]);

  // Active venue → use its sunniest patio's current sample to drive the 3D
  // map's lighting. Aligns the world-shadows with the polygon the user picked.
  const activeSample = useMemo<SunSample | null>(() => {
    if (!activeVenueId) return null;
    const venue = venues.find((v) => v.id === activeVenueId);
    if (!venue) return null;
    let bestSample: SunSample | null = null;
    let bestSun = -1;
    for (const p of venue.patios) {
      const series = seriesByPatio[p.id];
      if (!series || series.length === 0) continue;
      let s = series[0];
      let sd = Math.abs(s.time.getTime() - currentMs);
      for (let i = 1; i < series.length; i++) {
        const d = Math.abs(series[i].time.getTime() - currentMs);
        if (d < sd) {
          s = series[i];
          sd = d;
        }
      }
      if (s.sunFraction > bestSun) {
        bestSun = s.sunFraction;
        bestSample = s;
      }
    }
    return bestSample;
  }, [activeVenueId, venues, seriesByPatio, currentMs]);

  /** Fly the map to a venue's location at a closer zoom + tilted angle. */
  const flyToVenue = useCallback((venue: Venue) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [venue.lng, venue.lat],
      zoom: 18.5,
      pitch: FOCUSED_PITCH,
      bearing: FOCUSED_BEARING,
      speed: 1.4,
      curve: 1.6,
      essential: true,
    });
  }, []);

  /** Ease the camera back to the flat overview. */
  const flyToOverview = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [DOWNTOWN_VIEW.longitude, DOWNTOWN_VIEW.latitude],
      zoom: DOWNTOWN_VIEW.zoom,
      pitch: DOWNTOWN_VIEW.pitch,
      bearing: DOWNTOWN_VIEW.bearing,
      speed: 1.6,
      curve: 1.4,
      essential: true,
    });
  }, []);

  const handleSelectVenue = useCallback(
    (id: string) => {
      // Toggle off if the user clicks the already-active venue.
      if (id === activeVenueId) {
        setActiveVenueId(null);
        flyToOverview();
        return;
      }
      setActiveVenueId(id);
      const venue = venues.find((v) => v.id === id);
      if (venue) flyToVenue(venue);
    },
    [activeVenueId, venues, flyToVenue, flyToOverview],
  );

  // Filtering pipeline — operates on venues now.
  const filteredVenues = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return venues.filter((v) => {
      if (filters.openNow && !v.openNow) return false;
      if (filters.outdoorOnly && !v.hasOutdoorSeating) return false;
      if (filters.hoods.size > 0 && (!v.hood || !filters.hoods.has(v.hood))) return false;
      if (q) {
        const hay = `${v.name} ${v.hood ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [venues, filters]);

  const rows = useMemo<RankedVenue[]>(() => {
    let pool = filteredVenues;
    if (tab === 'saved') pool = pool.filter((v) => favourites.has(v.id));
    const annotated: RankedVenue[] = pool.map((v) => ({
      venue: v,
      sunPct: sunPctByVenue[v.id] ?? null,
    }));
    if (tab === 'ranking') {
      annotated.sort((a, b) => (b.sunPct ?? -1) - (a.sunPct ?? -1));
    } else {
      annotated.sort((a, b) => a.venue.name.localeCompare(b.venue.name));
    }
    return annotated;
  }, [filteredVenues, tab, favourites, sunPctByVenue]);

  const handleSelectDate = useCallback(
    (d: Date) => {
      const now = new Date();
      const next = dayAnchorUTC(d);
      setDate(next);
      const refTime = new Date(currentMs);
      const newCurrent = setSameTimeOfDay(d, isFinite(refTime.getTime()) ? refTime : now);
      setCurrentMs(newCurrent.getTime());
    },
    [currentMs],
  );

  const isToday = useMemo(() => isSameTorontoDay(date, new Date()), [date]);
  const dayLabel = isToday ? 'Today' : dayLabelFmt.format(date);
  const timeLabel = timeFmt.format(new Date(currentMs));

  // Keep the "patios tracked" count accurate — sum across venues.
  const totalPatios = useMemo(
    () => venues.reduce((n, v) => n + v.patios.length, 0),
    [venues],
  );

  return (
    <div className={styles.root} data-details-open={activeVenue ? 'true' : undefined}>
      <PatioMap
        ref={mapRef}
        initialViewState={DOWNTOWN_VIEW}
        mapStyle="mapbox://styles/mapbox/standard"
        basemapTheme="faded"
        basemapLightPreset={basemapLightPreset}
      >
        <VenuesLayer
          venues={filteredVenues}
          sunPctByPatio={sunPctByPatio}
          sunPctByVenue={sunPctByVenue}
          activeVenueId={activeVenueId}
          onSelectVenue={handleSelectVenue}
        />
        {activeSample && (
          <SunLightController
            azimuthDeg={activeSample.azimuthDeg}
            altitudeDeg={activeSample.altitudeDeg}
          />
        )}
        <div className={styles.controlsSlot}>
          <MapControls onRecenter={flyToOverview} showRecenter={!!activeVenueId} />
        </div>
        <div className={styles.attributionSlot}>
          <MapAttribution />
        </div>
      </PatioMap>

      <div className={styles.headerSlot}>
        <TopHeader
          patioCount={totalPatios}
          selectedDate={date}
          onSelectDate={handleSelectDate}
        />
      </div>

      {panelOpen ? (
        <div className={styles.panelSlot}>
          <RankingPanel
            ranked={rows}
            totalCount={filteredVenues.length}
            activeId={activeVenueId}
            favouriteIds={favourites}
            timeLabel={timeLabel}
            tab={tab}
            setTab={setTab}
            onSelect={handleSelectVenue}
            onToggleFavourite={toggleFavourite}
            onClose={() => setPanelOpen(false)}
            filters={filters}
            setFilters={setFilters}
          />
        </div>
      ) : (
        <button
          type="button"
          className={styles.panelOpener}
          onClick={() => setPanelOpen(true)}
          aria-label="Show rankings"
        >
          Rankings
        </button>
      )}

      {activeVenue ? (
        <div className={styles.detailsSlot}>
          <VenueDetailsPanel
            venue={activeVenue}
            sunPct={sunPctByVenue[activeVenue.id] ?? null}
            series={activeVenueSeries}
            currentMs={currentMs}
            isFavourite={favourites.has(activeVenue.id)}
            onToggleFavourite={() => toggleFavourite(activeVenue.id)}
            onClose={() => {
              setActiveVenueId(null);
              flyToOverview();
            }}
          />
        </div>
      ) : null}

      <div className={styles.timePillSlot}>
        <TimePill
          time={timeLabel}
          day={dayLabel}
          onReset={() => {
            const now = new Date();
            setDate(dayAnchorUTC(now));
            setCurrentMs(now.getTime());
          }}
        />
      </div>

      <div className={styles.timelineSlot}>
        <TimelineBar
          sunrise={sunrise}
          sunset={sunset}
          currentMs={currentMs}
          onChange={setCurrentMs}
        />
      </div>
    </div>
  );
}
