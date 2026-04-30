import type { Patio } from './types';

const STORAGE_KEY = 'patio-finder:patios:v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function listPatios(): Patio[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Patio[];
  } catch {
    return [];
  }
}

function save(patios: Patio[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patios));
}

export function addPatio(input: { name: string; polygon: GeoJSON.Polygon }): Patio {
  const patio: Patio = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    polygon: input.polygon,
    createdAt: new Date().toISOString(),
  };
  const next = [...listPatios(), patio];
  save(next);
  return patio;
}

export function removePatio(id: string): void {
  save(listPatios().filter(p => p.id !== id));
}

export function renamePatio(id: string, name: string): void {
  save(listPatios().map(p => (p.id === id ? { ...p, name } : p)));
}

export async function loadSeedPatios(): Promise<Patio[]> {
  if (!isBrowser()) return [];
  try {
    const res = await fetch('/api/patios');
    if (!res.ok) return listPatios();
    const seeds = (await res.json()) as Patio[];
    const existing = listPatios();
    const existingIds = new Set(existing.map(p => p.id));
    const merged = [...existing, ...seeds.filter(s => !existingIds.has(s.id))];
    if (merged.length !== existing.length) save(merged);
    return merged;
  } catch {
    return listPatios();
  }
}
