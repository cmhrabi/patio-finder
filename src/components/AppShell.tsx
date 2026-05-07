'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';
import PatioMap from './PatioMap';
import { VenuesLayer } from './VenuesLayer';
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
import type { SunSeriesResponse, WireSunSample } from '@/app/api/sun-series/route';
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

type LoadedWindow = { fromMs: number; toMs: number };

// Fetch a 3 h window of sun samples centered on the current scrub time, and
// refetch when the scrubber lands within 30 min of either edge. Keeps each
// request well under PostgREST's row cap regardless of patio count.
const WINDOW_HALF_MS = 90 * 60_000;
const REFETCH_MARGIN_MS = 30 * 60_000;
// How long the scrubber must sit still before we consider the time "settled"
// and fire a windowed fetch. Long enough that a continuous drag coalesces;
// short enough that the user doesn't notice the lag when they let go.
const SETTLE_DELAY_MS = 250;

function parseSamples(samples: WireSunSample[]): SunSample[] {
  return samples.map((s) => ({
    time: new Date(s.time),
    minutesFromSunrise: s.minutesFromSunrise,
    azimuthDeg: s.azimuthDeg,
    altitudeDeg: s.altitudeDeg,
    sunFraction: s.sunFraction,
    shadowGeoJson: s.shadowGeoJson ?? null,
  }));
}

const HOVER_PREFETCH_DELAY_MS = 120;

export default function AppShell() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [seriesByPatio, setSeriesByPatio] = useState<Record<string, SunSample[]>>({});
  const [loadedWindow, setLoadedWindow] = useState<LoadedWindow | null>(null);
  // Full-day series for any patio we've hovered or activated. Persists across
  // hovers so re-visiting a venue is instant. Wins over the windowed cache
  // when looking up shadows / sun%, so scrubbing on a known patio is smooth.
  const [fullDayByPatio, setFullDayByPatio] = useState<Record<string, SunSample[]>>({});
  const fullDayInflightRef = useRef<Set<string>>(new Set());
  const hoverDebounceRef = useRef<number | null>(null);
  const [activeVenueId, setActiveVenueId] = useState<string | null>(null);
  const [tab, setTab] = useState<RankingTab>('ranking');
  const [filters, setFilters] = useState<Filters>(() => emptyFilters());
  const [panelOpen, setPanelOpen] = useState(true);
  const [date, setDate] = useState<Date>(() => dayAnchorUTC(new Date()));
  /** Absolute scrub time, ms-since-epoch. Defaults to "now" on the selected day. */
  const [currentMs, setCurrentMs] = useState<number>(() => Date.now());
  /**
   * Debounced mirror of `currentMs` used to drive the windowed map fetch. While
   * the user is actively scrubbing, `currentMs` updates every frame; firing
   * (and then aborting) a network request on every margin crossing spams the
   * server. We debounce by ~250 ms so a fast scrub fires at most one GET when
   * the user pauses, plus a flush on release via the timeline's onCommit.
   */
  const [settledMs, setSettledMs] = useState<number>(() => Date.now());

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

  // Reset every per-date cache when the user switches days — every entry's
  // timestamps belong to a different `local_date`.
  useEffect(() => {
    setSeriesByPatio({});
    setLoadedWindow(null);
    setFullDayByPatio({});
    fullDayInflightRef.current.clear();
  }, [date]);

  // Debounce currentMs → settledMs so the windowed fetch fires at most once
  // per scrub "settle", not on every frame of a drag.
  useEffect(() => {
    const id = window.setTimeout(() => setSettledMs(currentMs), SETTLE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [currentMs]);

  const dayTimes = useMemo(
    () => getDayTimes(date, REPRESENTATIVE_POINT[1], REPRESENTATIVE_POINT[0]),
    [date],
  );
  const sunrise = dayTimes.sunrise && !isNaN(dayTimes.sunrise.getTime()) ? dayTimes.sunrise : null;
  const sunset = dayTimes.sunset && !isNaN(dayTimes.sunset.getTime()) ? dayTimes.sunset : null;

  // Map data fetcher: load a 3 h window around the *settled* scrub time.
  // Refetch when the settled time drifts within REFETCH_MARGIN_MS of either
  // edge of the loaded window. Driven by `settledMs` (debounced from
  // `currentMs`) so a continuous drag fires at most one GET per pause, not
  // one per frame.
  useEffect(() => {
    if (!sunrise || !sunset) return;
    const dayStart = sunrise.getTime();
    const dayEnd = sunset.getTime();
    const inDay = Math.min(dayEnd, Math.max(dayStart, settledMs));

    const stillInside =
      loadedWindow !== null &&
      inDay >= loadedWindow.fromMs + REFETCH_MARGIN_MS &&
      inDay <= loadedWindow.toMs - REFETCH_MARGIN_MS;
    if (stillInside) return;

    const targetFrom = Math.max(dayStart, inDay - WINDOW_HALF_MS);
    const targetTo = Math.min(dayEnd, inDay + WINDOW_HALF_MS);

    const ymd = ymdFmt.format(date);
    const params = new URLSearchParams({
      date: ymd,
      fromTs: new Date(targetFrom).toISOString(),
      toTs: new Date(targetTo).toISOString(),
    });
    const ctrl = new AbortController();
    void fetch(`/api/sun-series?${params.toString()}`, {
      cache: 'no-store',
      signal: ctrl.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<SunSeriesResponse>) : null))
      .then((body) => {
        if (!body) return;
        const out: Record<string, SunSample[]> = {};
        for (const [patioId, samples] of Object.entries(body.byPatioId)) {
          out[patioId] = parseSamples(samples);
        }
        setSeriesByPatio(out);
        setLoadedWindow({ fromMs: targetFrom, toMs: targetTo });
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        // eslint-disable-next-line no-console
        console.error('Failed to load sun series window:', e);
      });
    return () => ctrl.abort();
  }, [date, settledMs, loadedWindow, sunrise, sunset]);

  // Fetch full-day series for one patio and merge into the persistent cache.
  // No-ops if the patio is already cached or in flight. Per-patio queries stay
  // tiny (~175 rows) so each call is well under the row cap.
  const ensureFullDayLoaded = useCallback(
    (patioIds: string[]) => {
      if (patioIds.length === 0) return;
      const ymd = ymdFmt.format(date);
      for (const pid of patioIds) {
        const inflightKey = `${ymd}|${pid}`;
        if (fullDayInflightRef.current.has(inflightKey)) continue;
        // Use the ref via getter on each call so this stays a stable callback.
        // Skip if we already have a full day cached for this patio.
        // (If a stale entry from an old date sneaks in, the date-reset effect
        // clears the map.)
        fullDayInflightRef.current.add(inflightKey);
        void fetch(`/api/sun-series?date=${ymd}&patioId=${pid}`, { cache: 'no-store' })
          .then((res) => (res.ok ? (res.json() as Promise<SunSeriesResponse>) : null))
          .then((body) => {
            if (!body) return;
            const samples = body.byPatioId[pid] ?? [];
            setFullDayByPatio((prev) =>
              prev[pid] ? prev : { ...prev, [pid]: parseSamples(samples) },
            );
          })
          .catch((e: unknown) => {
            // eslint-disable-next-line no-console
            console.error(`Failed to load full-day series for ${pid}:`, e);
          })
          .finally(() => {
            fullDayInflightRef.current.delete(inflightKey);
          });
      }
    },
    [date],
  );

  // Hover prefetch: debounce 120 ms so quickly skimming the cursor across rows
  // / dots doesn't fire a fetch for every venue. Calling with `null` cancels a
  // pending prefetch.
  const handleHoverVenue = useCallback(
    (venueId: string | null) => {
      if (hoverDebounceRef.current !== null) {
        window.clearTimeout(hoverDebounceRef.current);
        hoverDebounceRef.current = null;
      }
      if (!venueId) return;
      hoverDebounceRef.current = window.setTimeout(() => {
        const venue = venues.find((v) => v.id === venueId);
        if (!venue) return;
        const need = venue.patios
          .map((p) => p.id)
          .filter((id) => !fullDayByPatio[id]);
        if (need.length > 0) ensureFullDayLoaded(need);
      }, HOVER_PREFETCH_DELAY_MS);
    },
    [venues, fullDayByPatio, ensureFullDayLoaded],
  );

  // Active-venue prefetch: clicking a venue without first hovering still needs
  // the full-day data for the sparkline + smooth shadow scrub. No-ops when the
  // hover prefetch already populated the cache.
  useEffect(() => {
    if (!activeVenueId) return;
    const venue = venues.find((v) => v.id === activeVenueId);
    if (!venue) return;
    const need = venue.patios.map((p) => p.id).filter((id) => !fullDayByPatio[id]);
    if (need.length > 0) ensureFullDayLoaded(need);
  }, [activeVenueId, venues, fullDayByPatio, ensureFullDayLoaded]);

  useEffect(
    () => () => {
      if (hoverDebounceRef.current !== null) {
        window.clearTimeout(hoverDebounceRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!sunrise || !sunset) return;
    setCurrentMs((prev) => {
      if (prev >= sunrise.getTime() && prev <= sunset.getTime()) return prev;
      const noon = sunrise.getTime() + (sunset.getTime() - sunrise.getTime()) / 2;
      return noon;
    });
  }, [sunrise, sunset]);

  // For each patio, find the sample closest to currentMs. Reused by both the
  // sun% and shadow-polygon lookups below. Prefer the full-day cache (hover-
  // or click-prefetched) over the windowed cache so scrubbing a known patio
  // never has to wait on a window refetch.
  const closestSampleByPatio = useMemo<Record<string, SunSample | null>>(() => {
    const out: Record<string, SunSample | null> = {};
    for (const v of venues) {
      for (const p of v.patios) {
        const series = fullDayByPatio[p.id] ?? seriesByPatio[p.id];
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
        out[p.id] = best;
      }
    }
    return out;
  }, [venues, seriesByPatio, fullDayByPatio, currentMs]);

  const sunPctByPatio = useMemo<Record<string, number | null>>(() => {
    const out: Record<string, number | null> = {};
    for (const id of Object.keys(closestSampleByPatio)) {
      const s = closestSampleByPatio[id];
      out[id] = s ? s.sunFraction * 100 : null;
    }
    return out;
  }, [closestSampleByPatio]);

  const shadowByPatio = useMemo<Record<string, GeoJSON.MultiPolygon | null>>(() => {
    const out: Record<string, GeoJSON.MultiPolygon | null> = {};
    for (const id of Object.keys(closestSampleByPatio)) {
      const s = closestSampleByPatio[id];
      out[id] = s?.shadowGeoJson ?? null;
    }
    return out;
  }, [closestSampleByPatio]);

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
  // signal, so its full-day series is what we plot. Sourced from the shared
  // full-day cache populated by hover + click prefetch.
  const activeVenueSeries = useMemo<SunSample[]>(() => {
    if (!activeVenue) return [];
    let best: SunSample[] = [];
    let bestPeak = -1;
    for (const p of activeVenue.patios) {
      const series = fullDayByPatio[p.id];
      if (!series || series.length === 0) continue;
      let peak = 0;
      for (const s of series) if (s.sunFraction > peak) peak = s.sunFraction;
      if (peak > bestPeak) {
        bestPeak = peak;
        best = series;
      }
    }
    return best;
  }, [activeVenue, fullDayByPatio]);


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
      >
        <VenuesLayer
          venues={filteredVenues}
          sunPctByPatio={sunPctByPatio}
          shadowByPatio={shadowByPatio}
          sunPctByVenue={sunPctByVenue}
          activeVenueId={activeVenueId}
          onSelectVenue={handleSelectVenue}
          onHoverVenue={handleHoverVenue}
        />
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
            onHoverVenue={handleHoverVenue}
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
          onCommit={(ms) => setSettledMs(ms)}
        />
      </div>
    </div>
  );
}
