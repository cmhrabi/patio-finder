const FALLBACK_HEIGHT_M = 6;
const METRES_PER_LEVEL = 3;

function parseMetres(raw: string | undefined): number | null {
  if (!raw) return null;
  // OSM height tags are usually plain numbers but may include a unit suffix
  // ("12", "12 m", "12.5 metres"). Strip non-numeric chars and parse.
  const n = parseFloat(String(raw).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Resolve a building height in metres from OSM tags using the cascade:
 *   1. `height` (or `building:height`) — already in metres in OSM
 *   2. `building:levels` × 3 m
 *   3. 6 m default (≈ 2 storeys)
 */
export function resolveHeightM(tags: Record<string, string | undefined>): number {
  const direct = parseMetres(tags.height) ?? parseMetres(tags['building:height']);
  if (direct != null) return direct;
  const levels = parseFloat(tags['building:levels'] ?? '');
  if (Number.isFinite(levels) && levels > 0) return levels * METRES_PER_LEVEL;
  return FALLBACK_HEIGHT_M;
}
