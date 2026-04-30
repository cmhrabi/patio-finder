import type { Patio } from './types';

/**
 * Fetch the canonical patio list from the DB-backed API route.
 *
 * No localStorage caching, no merging — Supabase is the single source of truth.
 * If you need offline cache, layer it on top of this rather than baking it in here.
 */
export async function fetchPatios(): Promise<Patio[]> {
  const res = await fetch('/api/patios', { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch /api/patios failed: ${res.status}`);
  const data = (await res.json()) as Patio[] | { error: string };
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
    // ignore — quota/security errors don't matter for a one-shot cleanup
  }
}
