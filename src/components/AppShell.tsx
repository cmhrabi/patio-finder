'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PatioMap from './PatioMap';
import { MapboxBuildingsSource } from './MapboxBuildingsSource';
import { BuildingsFromMap } from './BuildingsFromMap';
import { PatioLayer } from './PatioLayer';
import { DrawControl } from './DrawControl';
import { SunLightController } from './SunLightController';
import { PatioSidebar } from './PatioSidebar';
import { TimeScrubber } from './TimeScrubber';
import {
  addPatio,
  listPatios,
  loadSeedPatios,
  removePatio,
} from '@/lib/patios/storage';
import type { Patio } from '@/lib/patios/types';
import { computeSeries } from '@/lib/sun/timeSeries';
import type { Building, LngLat, SunSample } from '@/lib/sun/types';

const LADYBUG_VIEW = {
  longitude: -79.4275,
  latitude: 43.6535,
  zoom: 16.5,
  pitch: 60,
  bearing: -17.6,
};

const TZ = 'America/Toronto';

function dayAnchorUTC(d: Date): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const [y, m, day] = ymd.split('-').map(Number);
  // 16:00 UTC ≈ noon America/Toronto across DST transitions; only used as a date anchor.
  return new Date(Date.UTC(y, m - 1, day, 16));
}

export default function AppShell() {
  const [patios, setPatios] = useState<Patio[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [date, setDate] = useState<Date>(() => dayAnchorUTC(new Date()));
  // -1 is a sentinel meaning "use the series midpoint as default".
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [buildings, setBuildings] = useState<Building[] | null>(null);

  useEffect(() => {
    // Hydrate from localStorage and seed endpoint after mount (window-only).
    const initial = listPatios();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPatios(initial);
    if (initial[0]) setActiveId((id) => id ?? initial[0].id);
    void loadSeedPatios().then((merged) => {
      setPatios(merged);
      if (merged[0]) setActiveId((id) => id ?? merged[0].id);
    });
  }, []);

  const buildingsCenter: LngLat = useMemo(
    () => [LADYBUG_VIEW.longitude, LADYBUG_VIEW.latitude],
    [],
  );
  const handleBuildings = useCallback((bs: Building[]) => setBuildings(bs), []);

  const activePatio = useMemo(
    () => patios.find((p) => p.id === activeId) ?? null,
    [patios, activeId],
  );

  const series = useMemo<SunSample[]>(() => {
    if (!activePatio || !buildings) return [];
    return computeSeries({
      patioId: activePatio.id,
      patio: activePatio.polygon,
      buildings,
      date,
    });
  }, [activePatio, buildings, date]);

  // Clamp at read time rather than syncing state (avoids cascading renders).
  // Use the series midpoint when currentIndex is at the sentinel or out of range.
  const effectiveIndex =
    series.length === 0
      ? 0
      : currentIndex < 0 || currentIndex >= series.length
        ? Math.floor(series.length / 2)
        : currentIndex;
  const sample = series[effectiveIndex] ?? null;

  const handleCreate = useCallback(
    (e: { features: Array<{ geometry: GeoJSON.Polygon }> }) => {
      const f = e.features[0];
      if (!f) return;
      const defaultName = `Patio ${patios.length + 1}`;
      const name = window.prompt('Name this patio', defaultName)?.trim() || defaultName;
      const created = addPatio({ name, polygon: f.geometry });
      setPatios(listPatios());
      setActiveId(created.id);
      setDrawMode(false);
    },
    [patios.length],
  );

  const setActivePatio = useCallback((id: string | null) => {
    setActiveId(id);
    setCurrentIndex(-1);
  }, []);

  const setDateAndReset = useCallback((d: Date) => {
    setDate(d);
    setCurrentIndex(-1);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      removePatio(id);
      setPatios(listPatios());
      if (activeId === id) setActiveId(null);
    },
    [activeId],
  );

  return (
    <div
      className="grid h-full w-full"
      style={{ gridTemplateColumns: '1fr 18rem', gridTemplateRows: '1fr auto' }}
    >
      <div className="relative col-start-1 row-start-1 overflow-hidden">
        <PatioMap initialViewState={LADYBUG_VIEW}>
          <MapboxBuildingsSource />
          <BuildingsFromMap center={buildingsCenter} onBuildings={handleBuildings} />
          <PatioLayer polygon={activePatio?.polygon ?? null} />
          {drawMode && <DrawControl onCreate={handleCreate} />}
          {sample && (
            <SunLightController
              azimuthDeg={sample.azimuthDeg}
              altitudeDeg={sample.altitudeDeg}
            />
          )}
        </PatioMap>
      </div>
      <div className="col-start-2 row-start-1 row-span-2 h-full overflow-hidden">
        <PatioSidebar
          patios={patios}
          activeId={activeId}
          drawMode={drawMode}
          onSetActive={setActivePatio}
          onToggleDraw={() => setDrawMode((v) => !v)}
          onDelete={handleDelete}
        />
      </div>
      <div className="col-start-1 row-start-2">
        <TimeScrubber
          date={date}
          setDate={setDateAndReset}
          series={series}
          currentIndex={effectiveIndex}
          setCurrentIndex={setCurrentIndex}
        />
      </div>
    </div>
  );
}
