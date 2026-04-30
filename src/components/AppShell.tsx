'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';
import PatioMap from './PatioMap';
import { MapboxBuildingsSource } from './MapboxBuildingsSource';
import { BuildingsFromMap } from './BuildingsFromMap';
import { PatiosLayer } from './PatiosLayer';
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
  type RankedPatio,
} from './app/RankingPanel';
import { useFavourites } from '@/hooks/useFavourites';
import { clearLegacyPatioCache, fetchPatios } from '@/lib/patios/storage';
import type { Patio } from '@/lib/patios/types';
import { getDayTimes } from '@/lib/sun/sunPosition';
import { computeSeries } from '@/lib/sun/timeSeries';
import type { Building, LngLat, SunSample } from '@/lib/sun/types';
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
  // Anchor at 00:00 UTC of the calendar day, then derive Toronto-midnight UTC,
  // then add the time-of-day offset. Use the offset trick used in TimelineBar:
  const utcMidnightGuess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const obs = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hour: '2-digit', hour12: false })
      .format(utcMidnightGuess),
  );
  const torontoMidnightUtc = new Date(utcMidnightGuess.getTime() - obs * 60 * 60 * 1000);
  return new Date(torontoMidnightUtc.getTime() + offset);
}

const REPRESENTATIVE_POINT: LngLat = [DOWNTOWN_VIEW.longitude, DOWNTOWN_VIEW.latitude];

export default function AppShell() {
  const [patios, setPatios] = useState<Patio[]>([]);
  const [buildings, setBuildings] = useState<Building[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<RankingTab>('ranking');
  const [filters, setFilters] = useState<Filters>(() => emptyFilters());
  const [panelOpen, setPanelOpen] = useState(true);
  const [date, setDate] = useState<Date>(() => dayAnchorUTC(new Date()));
  /** Absolute scrub time, ms-since-epoch. Defaults to "now" on the selected day. */
  const [currentMs, setCurrentMs] = useState<number>(() => Date.now());

  const { favourites, toggle: toggleFavourite } = useFavourites();
  const mapRef = useRef<MapRef | null>(null);

  // Hydrate patios from the DB. Also wipe the legacy localStorage cache from
  // the pre-DB DrawControl flow — it would otherwise inject stale stub patios
  // back into the merge on every reload.
  useEffect(() => {
    clearLegacyPatioCache();
    let cancelled = false;
    void fetchPatios()
      .then((next) => {
        if (!cancelled) setPatios(next);
      })
      .catch((e) => {
        // Surface to the console so it shows in dev; don't crash the UI.
        // eslint-disable-next-line no-console
        console.error('Failed to load patios:', e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBuildings = useCallback((bs: Building[]) => setBuildings(bs), []);

  // Sunrise/sunset for the selected date — derived from the city centre.
  const dayTimes = useMemo(
    () => getDayTimes(date, REPRESENTATIVE_POINT[1], REPRESENTATIVE_POINT[0]),
    [date],
  );
  const sunrise = dayTimes.sunrise && !isNaN(dayTimes.sunrise.getTime()) ? dayTimes.sunrise : null;
  const sunset = dayTimes.sunset && !isNaN(dayTimes.sunset.getTime()) ? dayTimes.sunset : null;

  // Clamp scrub time to the selected day's sunrise–sunset window. If the
  // selected day is "today" and now is between sunrise and sunset, default
  // to now; otherwise default to noon.
  useEffect(() => {
    if (!sunrise || !sunset) return;
    setCurrentMs((prev) => {
      if (prev >= sunrise.getTime() && prev <= sunset.getTime()) return prev;
      const noon = sunrise.getTime() + (sunset.getTime() - sunrise.getTime()) / 2;
      return noon;
    });
  }, [sunrise, sunset]);

  // Compute series for every patio at this date. The internal cache means
  // repeated calls (different scrub times, same date) are free.
  const seriesByPatio = useMemo(() => {
    const out: Record<string, SunSample[]> = {};
    if (!buildings) return out;
    for (const p of patios) {
      out[p.id] = computeSeries({
        patioId: p.id,
        patio: p.polygon,
        buildings,
        date,
      });
    }
    return out;
  }, [patios, buildings, date]);

  // For each patio, find the sample closest to currentMs and convert sunFraction → 0..100.
  const sunPctByPatio = useMemo<Record<string, number | null>>(() => {
    const out: Record<string, number | null> = {};
    for (const p of patios) {
      const series = seriesByPatio[p.id];
      if (!series || series.length === 0) {
        out[p.id] = null;
        continue;
      }
      // Binary search for closest time would be ideal; linear is fine for ~180 samples.
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
    return out;
  }, [patios, seriesByPatio, currentMs]);

  // Active patio's current sample drives the 3D map's lighting.
  const activeSample = useMemo<SunSample | null>(() => {
    if (!activeId) return null;
    const series = seriesByPatio[activeId];
    if (!series || series.length === 0) return null;
    let best = series[0];
    let bestDelta = Math.abs(best.time.getTime() - currentMs);
    for (let i = 1; i < series.length; i++) {
      const delta = Math.abs(series[i].time.getTime() - currentMs);
      if (delta < bestDelta) {
        best = series[i];
        bestDelta = delta;
      }
    }
    return best;
  }, [activeId, seriesByPatio, currentMs]);

  // No auto-select: the map stays flat with all patios visible until the user picks one.

  /** Fly the map to a patio's centroid at a closer zoom + tilted angle. */
  const flyToPatio = useCallback(
    (patio: Patio) => {
      const map = mapRef.current;
      if (!map) return;
      const ring = patio.polygon.coordinates[0];
      if (!ring || ring.length === 0) return;
      // Average the ring's vertices, ignoring the closing duplicate point.
      let sx = 0;
      let sy = 0;
      let n = 0;
      const last = ring.length - 1;
      const stop =
        ring.length > 1 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1]
          ? last
          : ring.length;
      for (let i = 0; i < stop; i++) {
        sx += ring[i][0];
        sy += ring[i][1];
        n++;
      }
      if (n === 0) return;
      map.flyTo({
        center: [sx / n, sy / n],
        zoom: 17,
        pitch: FOCUSED_PITCH,
        bearing: FOCUSED_BEARING,
        speed: 1.4,
        curve: 1.6,
        essential: true,
      });
    },
    [],
  );

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

  const handleSelectPatio = useCallback(
    (id: string) => {
      // Toggle off if the user clicks the already-active patio.
      if (id === activeId) {
        setActiveId(null);
        flyToOverview();
        return;
      }
      setActiveId(id);
      const patio = patios.find((p) => p.id === id);
      if (patio) flyToPatio(patio);
    },
    [activeId, patios, flyToPatio, flyToOverview],
  );

  // Filtering pipeline.
  const filteredPatios = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return patios.filter((p) => {
      if (filters.openNow && !p.openNow) return false;
      if (filters.outdoorOnly && !p.hasOutdoorSeating) return false;
      if (filters.hoods.size > 0 && (!p.hood || !filters.hoods.has(p.hood))) return false;
      if (q) {
        const hay = `${p.name} ${p.hood ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [patios, filters]);

  // Rows shown in the current tab (excludes filters tab — that has its own UI).
  const rows = useMemo<RankedPatio[]>(() => {
    let pool = filteredPatios;
    if (tab === 'saved') pool = pool.filter((p) => favourites.has(p.id));
    const annotated: RankedPatio[] = pool.map((p) => ({ patio: p, sunPct: sunPctByPatio[p.id] ?? null }));
    if (tab === 'ranking') {
      annotated.sort((a, b) => (b.sunPct ?? -1) - (a.sunPct ?? -1));
    } else {
      // All / Saved: stable alphabetic order.
      annotated.sort((a, b) => a.patio.name.localeCompare(b.patio.name));
    }
    return annotated;
  }, [filteredPatios, tab, favourites, sunPctByPatio]);

  // Header tap on a date pill: keep the user's current time-of-day.
  const handleSelectDate = useCallback(
    (d: Date) => {
      const now = new Date();
      const next = dayAnchorUTC(d);
      setDate(next);
      // Translate the current scrub time-of-day onto the new day.
      const refTime = new Date(currentMs);
      const newCurrent = setSameTimeOfDay(d, isFinite(refTime.getTime()) ? refTime : now);
      setCurrentMs(newCurrent.getTime());
    },
    [currentMs],
  );

  const isToday = useMemo(() => isSameTorontoDay(date, new Date()), [date]);
  const dayLabel = isToday ? 'Today' : dayLabelFmt.format(date);
  const timeLabel = timeFmt.format(new Date(currentMs));

  return (
    <div className={styles.root}>
      <PatioMap
        ref={mapRef}
        initialViewState={DOWNTOWN_VIEW}
        mapStyle="mapbox://styles/mapbox/dark-v11"
      >
        <MapboxBuildingsSource />
        <BuildingsFromMap center={REPRESENTATIVE_POINT} onBuildings={handleBuildings} />
        <PatiosLayer patios={filteredPatios} sunPct={sunPctByPatio} activeId={activeId} />
        {activeSample && (
          <SunLightController
            azimuthDeg={activeSample.azimuthDeg}
            altitudeDeg={activeSample.altitudeDeg}
          />
        )}
        <div className={styles.controlsSlot}>
          <MapControls onRecenter={flyToOverview} showRecenter={!!activeId} />
        </div>
        <div className={styles.attributionSlot}>
          <MapAttribution />
        </div>
      </PatioMap>

      <div className={styles.headerSlot}>
        <TopHeader
          patioCount={patios.length}
          selectedDate={date}
          onSelectDate={handleSelectDate}
        />
      </div>

      {panelOpen ? (
        <div className={styles.panelSlot}>
          <RankingPanel
            ranked={rows}
            totalCount={filteredPatios.length}
            activeId={activeId}
            favouriteIds={favourites}
            timeLabel={timeLabel}
            tab={tab}
            setTab={setTab}
            onSelect={handleSelectPatio}
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

      <div className={styles.timePillSlot}>
        <TimePill time={timeLabel} day={dayLabel} />
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
