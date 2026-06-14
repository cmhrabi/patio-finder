import type { Building } from '@/lib/sun/types'

type LngLat = [number, number]

/** Mean of a ring's vertices in lng/lat, skipping a trailing closing duplicate. */
function ringCentroidLngLat(ring: number[][]): LngLat {
  const last = ring.length - 1
  const closed =
    ring.length > 1 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1]
  const stop = closed ? last : ring.length
  let sx = 0
  let sy = 0
  for (let i = 0; i < stop; i++) {
    sx += ring[i][0]
    sy += ring[i][1]
  }
  return [sx / stop, sy / stop]
}

/**
 * Cheap geographic pre-filter: keep only buildings whose footprint centroid is
 * within `radiusM` of `centre`, using an equirectangular metres approximation.
 *
 * `computeSeries` already does a precise frame-relative distance cull
 * (`ABSOLUTE_MAX_M = 200 m` on the building centroid). This runs *before* that —
 * so each per-patio workflow step only parses/projects nearby buildings instead
 * of the full ~3 MB set. The default radius is deliberately generous (300 m >
 * 200 m) so this is a strict superset of what `computeSeries` keeps and can
 * never drop a building the precise pass would have used.
 */
export function filterBuildingsNear(
  buildings: Building[],
  centre: LngLat,
  radiusM = 300,
): Building[] {
  const [clng, clat] = centre
  const cosLat = Math.cos((clat * Math.PI) / 180)
  const r2 = radiusM * radiusM
  const out: Building[] = []
  for (const b of buildings) {
    const ring = b.footprint?.[0]
    if (!ring || ring.length < 4) continue
    const [blng, blat] = ringCentroidLngLat(ring)
    const dx = (blng - clng) * cosLat * 111_320
    const dy = (blat - clat) * 111_320
    if (dx * dx + dy * dy <= r2) out.push(b)
  }
  return out
}
