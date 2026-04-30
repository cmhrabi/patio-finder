'use client';

import { useMemo } from 'react';
import type { SunSample } from '@/lib/sun/types';

type Props = {
  date: Date;
  setDate: (d: Date) => void;
  series: SunSample[];
  currentIndex: number;
  setCurrentIndex: (i: number) => void;
};

const TZ = 'America/Toronto';

const timeFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function TimeScrubber({ date, setDate, series, currentIndex, setCurrentIndex }: Props) {
  const sample = series[currentIndex];

  const dateValue = useMemo(() => dateFmt.format(date), [date]);

  const sunrise = series[0]?.time;
  const sunset = series[series.length - 1]?.time;

  return (
    <div className="flex w-full items-center gap-4 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
      <input
        type="date"
        value={dateValue}
        onChange={(e) => {
          const [y, m, d] = e.target.value.split('-').map(Number);
          // Use 16:00 UTC as a stable "this day in Toronto" anchor for getTimes().
          setDate(new Date(Date.UTC(y, m - 1, d, 16)));
        }}
        className="rounded border border-neutral-300 px-2 py-1 text-sm"
      />
      <span className="hidden text-xs text-neutral-500 md:inline">
        {sunrise && sunset ? `${timeFmt.format(sunrise)} → ${timeFmt.format(sunset)}` : '—'}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(0, series.length - 1)}
        step={1}
        value={Math.min(currentIndex, Math.max(0, series.length - 1))}
        onChange={(e) => setCurrentIndex(Number(e.target.value))}
        className="flex-1 accent-yellow-500"
        disabled={series.length === 0}
      />
      <div className="min-w-[10rem] text-right font-mono text-sm">
        {sample ? (
          <>
            <span className="font-semibold">{timeFmt.format(sample.time)}</span>
            <span className="ml-2 text-neutral-700">{Math.round(sample.sunFraction * 100)}% sunlit</span>
          </>
        ) : (
          <span className="text-neutral-500">no patio selected</span>
        )}
      </div>
    </div>
  );
}
