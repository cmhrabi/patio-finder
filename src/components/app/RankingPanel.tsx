'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Filter, Grid as GridIcon, Search, Star as StarIcon, Sun, X } from 'lucide-react';
import { Eyebrow } from '@/components/Eyebrow';
import { Heading } from '@/components/Heading';
import { Star } from '@/components/Star';
import { SunRating } from '@/components/SunRating';
import { Toggle } from '@/components/Toggle';
import { Stack } from '@/components/layout/Stack';
import { NEIGHBOURHOODS, type Neighbourhood, type Patio } from '@/lib/patios/types';
import styles from './RankingPanel.module.css';

export type RankingTab = 'ranking' | 'all' | 'saved' | 'filters';

export type Filters = {
  search: string;
  openNow: boolean;
  outdoorOnly: boolean;
  hoods: Set<Neighbourhood>;
};

export const emptyFilters = (): Filters => ({
  search: '',
  openNow: false,
  outdoorOnly: false,
  hoods: new Set(),
});

export type RankedPatio = {
  patio: Patio;
  /** 0..100 sun coverage at the active time. Null while still computing. */
  sunPct: number | null;
};

type Props = {
  /** Already filtered + sorted (descending sun) by the parent. */
  ranked: RankedPatio[];
  totalCount: number;
  activeId: string | null;
  favouriteIds: ReadonlySet<string>;
  /** Localised current scrub time, e.g. "3:30 PM". Used in heading. */
  timeLabel: string;
  tab: RankingTab;
  setTab: (t: RankingTab) => void;
  onSelect: (id: string) => void;
  onToggleFavourite: (id: string) => void;
  onClose?: () => void;
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
};

export function RankingPanel({
  ranked,
  totalCount,
  activeId,
  favouriteIds,
  timeLabel,
  tab,
  setTab,
  onSelect,
  onToggleFavourite,
  onClose,
  filters,
  setFilters,
}: Props) {
  const savedCount = favouriteIds.size;

  return (
    <section className={styles.root} aria-label="Patio rankings">
      <div className={styles.tabs} role="tablist">
        <TabButton
          active={tab === 'ranking'}
          onClick={() => setTab('ranking')}
          icon={<Sun size={14} />}
          label="Ranking"
        />
        <TabButton
          active={tab === 'all'}
          onClick={() => setTab('all')}
          icon={<GridIcon size={14} />}
          label="All"
          count={totalCount}
        />
        <TabButton
          active={tab === 'saved'}
          onClick={() => setTab('saved')}
          icon={<StarIcon size={14} />}
          label="Saved"
          count={savedCount}
          countAccent
        />
        <TabButton
          active={tab === 'filters'}
          onClick={() => setTab('filters')}
          icon={<Filter size={14} />}
          label="Filters"
        />
      </div>

      <div className={styles.body}>
        {tab === 'filters' ? (
          <FiltersTab filters={filters} setFilters={setFilters} onClose={onClose} />
        ) : (
          <ListTab
            tab={tab}
            ranked={ranked}
            activeId={activeId}
            favouriteIds={favouriteIds}
            timeLabel={timeLabel}
            onSelect={onSelect}
            onToggleFavourite={onToggleFavourite}
            onClose={onClose}
          />
        )}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
  countAccent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  countAccent?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[styles.tab, active && styles.tabActive].filter(Boolean).join(' ')}
    >
      <span className={styles.tabIcon} aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
      {typeof count === 'number' ? (
        <span
          className={[styles.tabCount, countAccent && count > 0 && styles.tabCountAccent].filter(Boolean).join(' ')}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function ListTab({
  tab,
  ranked,
  activeId,
  favouriteIds,
  timeLabel,
  onSelect,
  onToggleFavourite,
  onClose,
}: {
  tab: RankingTab;
  ranked: RankedPatio[];
  activeId: string | null;
  favouriteIds: ReadonlySet<string>;
  timeLabel: string;
  onSelect: (id: string) => void;
  onToggleFavourite: (id: string) => void;
  onClose?: () => void;
}) {
  let eyebrow = 'Sunny right now';
  let heading = `Ranked at ${timeLabel}`;
  let emptyMessage = 'No patios match yet.';
  if (tab === 'all') {
    eyebrow = 'Browse';
    heading = 'All patios';
    emptyMessage = 'No patios in this area.';
  } else if (tab === 'saved') {
    eyebrow = 'Your shortlist';
    heading = 'Saved';
    emptyMessage = 'Tap the star on a patio to save it.';
  }

  return (
    <Stack gap="3">
      <header className={styles.header}>
        <Eyebrow accent={tab === 'ranking'}>{eyebrow}</Eyebrow>
        <div className={styles.headerRow}>
          <Heading size="display-sm" className={styles.heading}>
            {heading}
          </Heading>
          {onClose ? (
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Hide panel"
            >
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      {ranked.length === 0 ? (
        <p className={[styles.empty, 'type-body-md'].join(' ')}>{emptyMessage}</p>
      ) : (
        <ol className={styles.list}>
          {ranked.map((r, i) => {
            const showRank = tab === 'ranking';
            const fav = favouriteIds.has(r.patio.id);
            const active = r.patio.id === activeId;
            return (
              <li
                key={r.patio.id}
                className={[styles.row, active && styles.rowActive].filter(Boolean).join(' ')}
              >
                <button
                  type="button"
                  onClick={() => onSelect(r.patio.id)}
                  className={styles.rowInner}
                  aria-pressed={active}
                >
                  {r.patio.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.patio.photo}
                      alt=""
                      className={styles.thumb}
                      loading="lazy"
                      width={40}
                      height={40}
                    />
                  ) : (
                    <span className={styles.thumb} aria-hidden="true" />
                  )}
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>
                      {showRank ? (
                        <span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span>
                      ) : null}
                      <span className={styles.name}>{r.patio.name}</span>
                    </div>
                    <div className={styles.rowMeta}>
                      <span className={styles.hood}>{r.patio.hood ?? '—'}</span>
                      <SunRating value={r.sunPct ?? 0} size={8} hideLabel />
                      {r.sunPct !== null ? (
                        <span className={styles.pct}>{Math.round(r.sunPct)}%</span>
                      ) : (
                        <span className={styles.pctMute}>…</span>
                      )}
                    </div>
                  </div>
                </button>
                <Star
                  pressed={fav}
                  onChange={() => onToggleFavourite(r.patio.id)}
                  size={18}
                  className={styles.star}
                />
              </li>
            );
          })}
        </ol>
      )}
    </Stack>
  );
}

function FiltersTab({
  filters,
  setFilters,
  onClose,
}: {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  onClose?: () => void;
}) {
  const toggleHood = (h: Neighbourhood) => {
    setFilters((prev) => {
      const hoods = new Set(prev.hoods);
      if (hoods.has(h)) hoods.delete(h);
      else hoods.add(h);
      return { ...prev, hoods };
    });
  };

  const checkboxId = useMemo(() => Math.random().toString(36).slice(2, 7), []);

  return (
    <Stack gap="4">
      <header className={styles.header}>
        <Eyebrow accent>Refine</Eyebrow>
        <div className={styles.headerRow}>
          <Heading size="display-sm" className={styles.heading}>
            Filters
          </Heading>
          {onClose ? (
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Hide panel"
            >
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.searchField}>
        <Search size={14} aria-hidden="true" className={styles.searchIcon} />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
          placeholder="Search patios or neighbourhoods…"
          className={styles.searchInput}
          aria-label="Search patios or neighbourhoods"
        />
      </div>

      <div className={styles.toggleRow}>
        <span className="type-body-md">Open now</span>
        <Toggle
          checked={filters.openNow}
          onChange={(v) => setFilters((p) => ({ ...p, openNow: v }))}
          aria-label="Open now"
        />
      </div>
      <div className={[styles.toggleRow, styles.divider].join(' ')}>
        <span className="type-body-md">Has outdoor seating</span>
        <Toggle
          checked={filters.outdoorOnly}
          onChange={(v) => setFilters((p) => ({ ...p, outdoorOnly: v }))}
          aria-label="Has outdoor seating"
        />
      </div>

      <Stack gap="2">
        <Eyebrow>Neighbourhood</Eyebrow>
        <ul className={styles.checkList}>
          {NEIGHBOURHOODS.map((h) => {
            const id = `flt-${checkboxId}-${h.replace(/\s+/g, '-').toLowerCase()}`;
            const checked = filters.hoods.has(h);
            return (
              <li key={h} className={styles.checkItem}>
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleHood(h)}
                  className={styles.checkbox}
                />
                <label htmlFor={id} className={['type-body-md', styles.checkLabel].join(' ')}>
                  {h}
                </label>
              </li>
            );
          })}
        </ul>
      </Stack>
    </Stack>
  );
}
