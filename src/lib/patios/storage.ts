import type { Venue } from './types';

/**
 * Fetch the canonical venue list (with embedded patios) from the DB-backed API
 * route. No localStorage caching — Supabase is the single source of truth.
 */
export async function fetchVenues(): Promise<Venue[]> {
  const res = await fetch('/api/venues', { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch /api/venues failed: ${res.status}`);
  const data = (await res.json()) as Venue[] | { error: string };
  if (!Array.isArray(data)) throw new Error(data.error ?? 'unknown error');
  return data;
}

/** Legacy localStorage key from the pre-DB DrawControl flow. */
const LEGACY_KEY = 'patio-finder:patios:v1';

/**
 * Wipe the legacy `patio-finder:patios:v1` cache from localStorage. Safe to call
 * on every mount — no-op once it's gone.
 */
export function clearLegacyPatioCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}
