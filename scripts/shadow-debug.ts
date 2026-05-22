/**
 * Diagnostic: dump per-building shadow contributions for a single patio
 * at a given moment.
 *
 *   npm run shadow:debug -- --list
 *   npm run shadow:debug -- --venue="bar moroco" --time="2026-05-22T22:00:00Z"
 *   npm run shadow:debug -- --patio=<uuid> --time="2026-05-22T22:00:00Z"
 *
 * Default time is 2026-05-22T22:00:00Z (6pm EDT, mid-May Toronto).
 * Reads patios from Supabase (needs .env.local with NEXT_PUBLIC_SUPABASE_URL
 * and SUPABASE_SECRET_KEY) and buildings from public/buildings.geojson.
 *
 * Uses the same primitives as the live pipeline (shadows.ts, coverage.ts,
 * sunPosition.ts) so the numbers it prints match what the app computes.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import polygonClipping, {
  type MultiPolygon as PCMultiPolygon,
  type Polygon as PCPolygon,
} from 'polygon-clipping'
import { makeFrame } from '@/lib/sun/projection'
import { getSunPosition } from '@/lib/sun/sunPosition'
import { buildShadow } from '@/lib/sun/shadows'
import {
  polygonArea,
  multiPolygonArea,
  computeCoverage,
  clipHostBuildings,
} from '@/lib/sun/coverage'
import type {
  Building,
  LngLat,
  MetricPolygon,
  ProjectedBuilding,
  Ring,
} from '@/lib/sun/types'

type Args = {
  patio?: string
  venue?: string
  time?: string
  list?: boolean
  top?: number
  excludeHost?: number
  dumpGeojson?: string
}

function parseArgs(argv: string[]): Args {
  const out: Args = {}
  for (const arg of argv) {
    if (arg === '--list') out.list = true
    else if (arg.startsWith('--patio=')) out.patio = arg.slice(8)
    else if (arg.startsWith('--venue=')) out.venue = arg.slice(8)
    else if (arg.startsWith('--time=')) out.time = arg.slice(7)
    else if (arg.startsWith('--top=')) out.top = Number(arg.slice(6))
    else if (arg.startsWith('--exclude-host=')) out.excludeHost = Number(arg.slice(15))
    else if (arg === '--exclude-host') out.excludeHost = 3
    else if (arg.startsWith('--dump-geojson=')) out.dumpGeojson = arg.slice(15)
  }
  return out
}

function ringCentroid(ring: number[][]): [number, number] {
  let sx = 0
  let sy = 0
  let n = 0
  const last = ring.length - 1
  const closed =
    ring.length > 1 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1]
  const stop = closed ? last : ring.length
  for (let i = 0; i < stop; i++) {
    sx += ring[i][0]
    sy += ring[i][1]
    n++
  }
  return [sx / n, sy / n]
}

type PatioRow = {
  id: string
  venue_id: string
  label: string | null
  area_geojson: GeoJSON.Polygon | null
}
type VenueRow = { id: string; name: string }

async function loadPatiosAndVenues(): Promise<{
  patios: Array<PatioRow & { venueName: string }>
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY. Run via `npm run shadow:debug` (which loads .env.local).',
    )
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [pRes, vRes] = await Promise.all([
    supabase
      .from('patios_geo')
      .select('id, venue_id, label, area_geojson')
      .returns<PatioRow[]>(),
    supabase.from('venues').select('id, name').returns<VenueRow[]>(),
  ])
  if (pRes.error) throw new Error(`patios_geo: ${pRes.error.message}`)
  if (vRes.error) throw new Error(`venues: ${vRes.error.message}`)
  const venueName = new Map(vRes.data!.map((v) => [v.id, v.name]))
  const patios = (pRes.data ?? [])
    .filter((p) => p.area_geojson && p.area_geojson.type === 'Polygon')
    .map((p) => ({ ...p, venueName: venueName.get(p.venue_id) ?? '(unknown)' }))
  return { patios }
}

type BuildingExt = Building & { idx: number; sourceProps: Record<string, unknown> }

async function loadBuildings(): Promise<BuildingExt[]> {
  const fp = path.join(process.cwd(), 'public', 'buildings.geojson')
  const raw = await readFile(fp, 'utf8')
  const fc = JSON.parse(raw) as GeoJSON.FeatureCollection
  const out: BuildingExt[] = []
  let idx = 0
  for (const f of fc.features) {
    const props = (f.properties ?? {}) as Record<string, unknown>
    const heightM = Number(props.heightM ?? 0)
    if (!isFinite(heightM) || heightM <= 0) continue
    const heightSource = (props.heightSource as 'avg' | 'max' | undefined) ?? undefined
    const meta = {
      heightSource,
      minH: typeof props.minH === 'number' ? props.minH : undefined,
      maxH: typeof props.maxH === 'number' ? props.maxH : undefined,
      avgH: typeof props.avgH === 'number' ? props.avgH : undefined,
    }
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Polygon') {
      out.push({ idx: idx++, footprint: g.coordinates, heightM, ...meta, sourceProps: props })
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) {
        out.push({ idx: idx++, footprint: poly, heightM, ...meta, sourceProps: props })
      }
    }
  }
  return out
}

function bearingDeg(dx: number, dy: number): number {
  // 0° = N, 90° = E (matches sun azimuth convention).
  const rad = Math.atan2(dx, dy)
  return ((rad * 180) / Math.PI + 360) % 360
}

function compassPoint(deg: number): string {
  const pts = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return pts[Math.round(deg / 45) % 8]
}

function distPointToRing(px: number, py: number, ring: number[][]): number {
  let best = Infinity
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i]
    const [bx, by] = ring[i + 1]
    const vx = bx - ax,
      vy = by - ay
    const wx = px - ax,
      wy = py - ay
    const c1 = vx * wx + vy * wy
    let t = c1 / (vx * vx + vy * vy)
    if (!isFinite(t)) t = 0
    t = Math.max(0, Math.min(1, t))
    const dx = ax + t * vx - px
    const dy = ay + t * vy - py
    const d = Math.hypot(dx, dy)
    if (d < best) best = d
  }
  return best
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { patios } = await loadPatiosAndVenues()

  if (args.list || (!args.patio && !args.venue)) {
    console.log(`${patios.length} patios in DB:`)
    for (const p of patios) {
      const c = ringCentroid(p.area_geojson!.coordinates[0])
      console.log(
        `  ${p.id}  [${c[1].toFixed(5)}, ${c[0].toFixed(5)}]  ${p.venueName}${p.label ? ' / ' + p.label : ''}`,
      )
    }
    if (!args.list) {
      console.log('\nPass --patio=<id> or --venue=<substring> to debug one.')
    }
    return
  }

  let target = patios.find((p) => p.id === args.patio)
  if (!target && args.venue) {
    const needle = args.venue.toLowerCase()
    target = patios.find((p) => p.venueName.toLowerCase().includes(needle))
  }
  if (!target) {
    console.error('No patio matched. Try --list to see options.')
    process.exit(1)
  }

  const when = args.time ? new Date(args.time) : new Date('2026-05-22T22:00:00Z')
  if (isNaN(when.getTime())) {
    console.error(`Invalid --time: ${args.time}`)
    process.exit(1)
  }

  const polygon = target.area_geojson!
  const origin = ringCentroid(polygon.coordinates[0]) as LngLat
  const [lon0, lat0] = origin
  const frame = makeFrame(origin)
  const patioMetric: MetricPolygon = polygon.coordinates.map((r) => frame.ringToMetres(r as Ring))
  const patioArea = polygonArea(patioMetric)

  const { azimuthDeg, altitudeDeg } = getSunPosition(when, lat0, lon0)

  console.log('=== Patio ===')
  console.log(`  id            ${target.id}`)
  console.log(`  venue         ${target.venueName}${target.label ? ' / ' + target.label : ''}`)
  console.log(`  centroid      lat ${lat0.toFixed(6)}, lon ${lon0.toFixed(6)}`)
  console.log(`  area          ${patioArea.toFixed(1)} m²`)
  console.log(`  vertices      ${polygon.coordinates[0].length - 1}`)
  console.log()
  console.log('=== Sun ===')
  console.log(`  time          ${when.toISOString()}  (${when.toLocaleString('en-CA', { timeZone: 'America/Toronto' })} Toronto)`)
  console.log(`  altitude      ${altitudeDeg.toFixed(2)}°`)
  console.log(`  azimuth       ${azimuthDeg.toFixed(1)}° (${compassPoint(azimuthDeg)})`)
  console.log(`  shadow dir    ${((azimuthDeg + 180) % 360).toFixed(1)}° (${compassPoint((azimuthDeg + 180) % 360)})`)
  console.log()

  if (altitudeDeg <= 0) {
    console.log('Sun is below the horizon — nothing to compute.')
    return
  }

  const buildings = await loadBuildings()

  // Project buildings into metric frame. Filter by per-building shadow reach so
  // we don't try to clip 50,000 polygons.
  const altRad = (altitudeDeg * Math.PI) / 180
  const tanAlt = Math.tan(altRad)
  const PATIO_RADIUS_M = 200

  type Projected = ProjectedBuilding & {
    idx: number
    distM: number
    centroidLngLat: [number, number]
    heightSource?: 'avg' | 'max'
    minH?: number
    maxH?: number
    avgH?: number
    sourceFootprint: number[][][]
  }

  // First pass: cheap lat/lon bbox.
  const HEIGHT_CAP = 500
  const maxKeepM = HEIGHT_CAP / tanAlt + PATIO_RADIUS_M
  const dLat = maxKeepM / 111_000
  const dLon = maxKeepM / (111_000 * Math.cos((lat0 * Math.PI) / 180))

  const projected: Projected[] = []
  for (const b of buildings) {
    const fp0 = b.footprint[0]
    if (!fp0 || fp0.length < 4) continue
    const [bx, by] = fp0[0]
    if (Math.abs(by - lat0) > dLat) continue
    if (Math.abs(bx - lon0) > dLon) continue
    const fpMetric = b.footprint.map((r) => frame.ringToMetres(r as Ring))
    const c = ringCentroid(fpMetric[0])
    const dist = Math.hypot(c[0], c[1])
    const buildingKeep = b.heightM / tanAlt + PATIO_RADIUS_M
    if (dist > buildingKeep) continue
    const cLngLat = ringCentroid(fp0) as [number, number]
    projected.push({
      idx: b.idx,
      footprint: fpMetric,
      heightM: b.heightM,
      heightSource: b.heightSource,
      minH: b.minH,
      maxH: b.maxH,
      avgH: b.avgH,
      distM: dist,
      centroidLngLat: cLngLat,
      sourceFootprint: b.footprint,
    })
  }

  // Apply the live pipeline's host-clip step on demand, so we can compare
  // "before vs. after". With `--exclude-host`, we run clipHostBuildings the
  // same way timeSeries.ts / snapshot.ts do.
  const applyClip = args.excludeHost !== undefined
  const projectedClipped = applyClip ? clipHostBuildings(patioMetric, projected) : projected

  // Track which building indexes were affected (clipped to a smaller polygon
  // or dropped entirely). Used for reporting only.
  const hostIdxs = new Set<number>()
  if (applyClip) {
    const keptIdxs = new Set(projectedClipped.map((b) => b.idx))
    for (const b of projected) {
      // If the original index appears in the clipped list with a smaller
      // footprint, or doesn't appear at all, treat it as a host hit.
      if (!keptIdxs.has(b.idx)) {
        hostIdxs.add(b.idx)
        continue
      }
      // Crude check: if multiple clipped entries share this idx, the original
      // got split — definitely clipped.
      const same = projectedClipped.filter((c) => c.idx === b.idx)
      if (same.length > 1) hostIdxs.add(b.idx)
    }
  }

  // Compute reference sun fraction (uses the same path as the live pipeline).
  const reference = computeCoverage(patioMetric, projectedClipped, azimuthDeg, altitudeDeg)
  const referenceNoExclude = computeCoverage(patioMetric, projected, azimuthDeg, altitudeDeg)

  // For each candidate, compute how much it contributes to the shadow on patio.
  type Contribution = Projected & { ownShadowOnPatio: number }
  const contribs: Contribution[] = []
  for (const b of projected) {
    const sh = buildShadow(b.footprint, b.heightM, azimuthDeg, altitudeDeg)
    if (sh.length === 0) {
      contribs.push({ ...b, ownShadowOnPatio: 0 })
      continue
    }
    let inter: PCMultiPolygon = []
    try {
      inter = polygonClipping.intersection(
        patioMetric as unknown as PCPolygon,
        sh as unknown as PCMultiPolygon,
      )
    } catch {
      // skip
    }
    const area = inter.length > 0 ? multiPolygonArea(inter as unknown as import("@/lib/sun/types").MetricMultiPolygon) : 0
    contribs.push({ ...b, ownShadowOnPatio: area })
  }

  contribs.sort((a, b) => b.ownShadowOnPatio - a.ownShadowOnPatio)

  console.log('=== Result ===')
  console.log(`  sun fraction  ${(referenceNoExclude.sunFraction * 100).toFixed(1)}% (raw, no host clipping)`)
  if (applyClip) {
    console.log(`  sun fraction  ${(reference.sunFraction * 100).toFixed(1)}% (with host clipping; ${hostIdxs.size} building(s) clipped)`)
    console.log(`  shaded area   ${(patioArea * (1 - reference.sunFraction)).toFixed(1)} m² of ${patioArea.toFixed(1)} m² (after clipping)`)
  } else {
    console.log(`  shaded area   ${(patioArea * (1 - referenceNoExclude.sunFraction)).toFixed(1)} m² of ${patioArea.toFixed(1)} m²`)
  }
  console.log(`  candidates    ${projected.length} buildings within shadow reach`)
  console.log()

  // Check polygon-vs-building overlap (the user's hypothesis #2).
  const overlapping: Array<{ idx: number; heightM: number; overlapM2: number; nearestEdgeM: number }> = []
  let nearestEdge = Infinity
  for (const b of projected) {
    let inter: PCMultiPolygon = []
    try {
      inter = polygonClipping.intersection(
        patioMetric as unknown as PCPolygon,
        b.footprint as unknown as PCPolygon,
      )
    } catch {
      // skip
    }
    const ovArea = inter.length > 0 ? multiPolygonArea(inter as unknown as import("@/lib/sun/types").MetricMultiPolygon) : 0
    // Distance from patio centroid to nearest point on this building's outer ring.
    const edgeDist = distPointToRing(0, 0, b.footprint[0])
    if (edgeDist < nearestEdge) nearestEdge = edgeDist
    if (ovArea > 0) overlapping.push({ idx: b.idx, heightM: b.heightM, overlapM2: ovArea, nearestEdgeM: edgeDist })
  }
  console.log('=== Patio ↔ building overlap check ===')
  console.log(`  nearest building edge: ${nearestEdge.toFixed(2)} m from patio centroid`)
  if (overlapping.length > 0) {
    console.log(`  ⚠️  patio polygon intersects ${overlapping.length} building footprint(s):`)
    for (const o of overlapping) {
      console.log(
        `    bldg #${o.idx} h=${o.heightM.toFixed(1)}m overlap=${o.overlapM2.toFixed(1)} m² (${((o.overlapM2 / patioArea) * 100).toFixed(0)}% of patio)`,
      )
    }
  } else {
    console.log('  no overlap with building footprints')
  }
  console.log()

  const N = args.top ?? 15
  console.log(`=== Top ${N} shadow contributors ===`)
  console.log('  rank  bldg#   contrib(m²)  %patio   height  source  dist(m)  bearing       lat,lon')
  let cumulative = 0
  for (let i = 0; i < Math.min(N, contribs.length); i++) {
    const c = contribs[i]
    if (c.ownShadowOnPatio <= 0) break
    cumulative += c.ownShadowOnPatio
    const bd = bearingDeg(c.centroidLngLat[0] - lon0, c.centroidLngLat[1] - lat0) // dx in lon, dy in lat — but bearingDeg uses metric ordering. Compute properly below.
    void bd
    // Use metric centroid for bearing.
    const mc = ringCentroid(c.footprint[0])
    const brg = bearingDeg(mc[0], mc[1])
    console.log(
      `  ${String(i + 1).padStart(4)}  #${String(c.idx).padEnd(6)}` +
        `  ${c.ownShadowOnPatio.toFixed(1).padStart(11)}` +
        `  ${((c.ownShadowOnPatio / patioArea) * 100).toFixed(0).padStart(5)}%` +
        `   ${c.heightM.toFixed(1).padStart(5)}m` +
        `   ${(c.heightSource ?? '?').padEnd(6)}` +
        `  ${c.distM.toFixed(0).padStart(7)}` +
        `  ${brg.toFixed(0).padStart(3)}° (${compassPoint(brg).padEnd(2)})` +
        `   ${c.centroidLngLat[1].toFixed(5)},${c.centroidLngLat[0].toFixed(5)}`,
    )
  }
  console.log()
  console.log(`  cumulative top-${N} contribution: ${cumulative.toFixed(1)} m² (sum of individuals — overlaps double-counted)`)
  console.log(`  actual shaded area:               ${(patioArea * (1 - referenceNoExclude.sunFraction)).toFixed(1)} m² (overlap-corrected via polygon union)`)

  if (args.dumpGeojson) {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { kind: 'patio', id: target.id, venue: target.venueName },
          geometry: polygon,
        },
      ],
    }
    for (let i = 0; i < Math.min(N, contribs.length); i++) {
      const c = contribs[i]
      if (c.ownShadowOnPatio <= 0) break
      fc.features.push({
        type: 'Feature',
        properties: {
          kind: 'shading-building',
          idx: c.idx,
          heightM: c.heightM,
          contribM2: Number(c.ownShadowOnPatio.toFixed(1)),
          distM: Number(c.distM.toFixed(0)),
          isHost: hostIdxs.has(c.idx),
        },
        geometry: { type: 'Polygon', coordinates: c.sourceFootprint },
      })
    }
    await (await import('node:fs/promises')).writeFile(
      args.dumpGeojson,
      JSON.stringify(fc, null, 2),
      'utf8',
    )
    console.log(`\nWrote GeoJSON to ${args.dumpGeojson} — paste into geojson.io to view.`)
  }
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
