'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Layer,
  Marker,
  Source,
  useMap,
  type MapMouseEvent,
} from 'react-map-gl/mapbox'
import PatioMap from '@/components/PatioMap'
import { DrawControl } from '@/components/DrawControl'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { Toggle } from '@/components/Toggle'
import { Heading } from '@/components/Heading'
import { Stack } from '@/components/layout'

export type VenueGeo = {
  id: string
  slug: string
  name: string
  lng: number
  lat: number
}

export type PatioGeo = {
  id: string
  venue_id: string
  label: string | null
  area_geojson: GeoJSON.Polygon
}

type Point = [number, number] // [lng, lat]

type Mode =
  | { kind: 'idle' }
  | { kind: 'placingVenuePoint' }
  | { kind: 'venueForm'; point: Point }
  | { kind: 'drawingPatio'; venueId: string; venueName: string }
  | {
      kind: 'patioForm'
      venueId: string
      venueName: string
      polygon: GeoJSON.Polygon
    }

const TORONTO_VIEW = { longitude: -79.3832, latitude: 43.6532, zoom: 12 }

type VenueFormState = {
  name: string
  address: string
  neighborhood: string
  website: string
  description: string
  dog_friendly: boolean
  heated: boolean
  covered: boolean
  food: boolean
  reservations: boolean
}

const emptyVenue: VenueFormState = {
  name: '',
  address: '',
  neighborhood: '',
  website: '',
  description: '',
  dog_friendly: false,
  heated: false,
  covered: false,
  food: false,
  reservations: false,
}

type PatioFormState = {
  label: string
  notes: string
  umbrellas: boolean
  awning: boolean
  retractable_roof: boolean
}

const emptyPatio: PatioFormState = {
  label: '',
  notes: '',
  umbrellas: false,
  awning: false,
  retractable_roof: false,
}

export default function AdminWorkspace({
  initialVenues,
  initialPatios,
}: {
  initialVenues: VenueGeo[]
  initialPatios: PatioGeo[]
}) {
  const [venues, setVenues] = useState<VenueGeo[]>(initialVenues)
  const [patios, setPatios] = useState<PatioGeo[]>(initialPatios)
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [venueForm, setVenueForm] = useState<VenueFormState>(emptyVenue)
  const [patioForm, setPatioForm] = useState<PatioFormState>(emptyPatio)
  const [pickVenueId, setPickVenueId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // -- map sources -----------------------------------------------------------

  const venuePoints = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: venues.map((v) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
        properties: { id: v.id, name: v.name },
      })),
    }),
    [venues],
  )

  const patioPolygons = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: patios.map((p) => ({
        type: 'Feature',
        geometry: p.area_geojson,
        properties: { id: p.id, label: p.label },
      })),
    }),
    [patios],
  )

  // -- handlers --------------------------------------------------------------

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (mode.kind !== 'placingVenuePoint') return
      const { lng, lat } = e.lngLat
      setMode({ kind: 'venueForm', point: [lng, lat] })
    },
    [mode],
  )

  const handlePolygonCreate = useCallback(
    (e: { features: Array<{ geometry: GeoJSON.Polygon }> }) => {
      if (mode.kind !== 'drawingPatio') return
      const polygon = e.features[0]?.geometry
      if (!polygon) return
      setMode({
        kind: 'patioForm',
        venueId: mode.venueId,
        venueName: mode.venueName,
        polygon,
      })
    },
    [mode],
  )

  const reset = useCallback(() => {
    setMode({ kind: 'idle' })
    setVenueForm(emptyVenue)
    setPatioForm(emptyPatio)
    setPickVenueId('')
    setError(null)
  }, [])

  const submitVenue = useCallback(async () => {
    if (mode.kind !== 'venueForm') return
    if (!venueForm.name.trim()) {
      setError('Venue name is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/venues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...venueForm,
          lng: mode.point[0],
          lat: mode.point[1],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'failed to create venue')

      const created: VenueGeo = {
        id: json.id,
        slug: json.slug,
        name: json.name,
        lng: mode.point[0],
        lat: mode.point[1],
      }
      setVenues((prev) => [...prev, created])
      setMode({ kind: 'drawingPatio', venueId: created.id, venueName: created.name })
      setVenueForm(emptyVenue)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to create venue')
    } finally {
      setBusy(false)
    }
  }, [mode, venueForm])

  const submitPatio = useCallback(async () => {
    if (mode.kind !== 'patioForm') return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/patios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          venue_id: mode.venueId,
          polygon: mode.polygon,
          ...patioForm,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'failed to create patio')

      setPatios((prev) => [
        ...prev,
        {
          id: json.id,
          venue_id: json.venue_id,
          label: json.label,
          area_geojson: mode.polygon,
        },
      ])
      reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to create patio')
    } finally {
      setBusy(false)
    }
  }, [mode, patioForm, reset])

  // -- render ----------------------------------------------------------------

  const cursor =
    mode.kind === 'placingVenuePoint' ? 'crosshair' : undefined

  return (
    <div
      className="grid h-full w-full"
      style={{ gridTemplateColumns: '1fr 22rem' }}
    >
      <div className="relative col-start-1 row-start-1 overflow-hidden">
        <PatioMap initialViewState={TORONTO_VIEW}>
          {/* Existing venues as small circles */}
          <Source id="venues-src" type="geojson" data={venuePoints}>
            <Layer
              id="venues-pts"
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': '#0f172a',
                'circle-stroke-color': '#fff',
                'circle-stroke-width': 2,
              }}
            />
          </Source>

          {/* Existing patios as fill + line */}
          <Source id="patios-src" type="geojson" data={patioPolygons}>
            <Layer
              id="patios-fill"
              type="fill"
              paint={{ 'fill-color': '#fbbf24', 'fill-opacity': 0.3 }}
            />
            <Layer
              id="patios-line"
              type="line"
              paint={{ 'line-color': '#f59e0b', 'line-width': 2 }}
            />
          </Source>

          {/* Pending venue marker */}
          {mode.kind === 'venueForm' && (
            <Marker longitude={mode.point[0]} latitude={mode.point[1]} anchor="bottom">
              <div className="rounded-full border-2 border-white bg-red-500 px-2 py-1 text-xs font-semibold text-white shadow">
                new venue
              </div>
            </Marker>
          )}

          {/* Pending patio polygon */}
          {mode.kind === 'patioForm' && (
            <Source
              id="pending-patio-src"
              type="geojson"
              data={{ type: 'Feature', geometry: mode.polygon, properties: {} }}
            >
              <Layer
                id="pending-patio-fill"
                type="fill"
                paint={{ 'fill-color': '#10b981', 'fill-opacity': 0.4 }}
              />
              <Layer
                id="pending-patio-line"
                type="line"
                paint={{ 'line-color': '#059669', 'line-width': 2.5 }}
              />
            </Source>
          )}

          {mode.kind === 'drawingPatio' && (
            <DrawControl onCreate={handlePolygonCreate} />
          )}

          {/* Wire map click for the placing-pin step */}
          <MapClickListener cursor={cursor} onClick={handleMapClick} />
        </PatioMap>
      </div>

      <aside
        className="col-start-2 row-start-1 h-full overflow-y-auto border-l border-neutral-200 bg-white"
        style={{ padding: 'var(--space-5)' }}
      >
        <Stack gap="5">
          <div>
            <Heading size="display-sm" as="h1">
              Add a patio
            </Heading>
            <p
              className="type-body-sm"
              style={{ color: 'var(--theme-text-mute)', marginTop: 'var(--space-1)' }}
            >
              {hint(mode)}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: '#fee2e2',
                color: '#991b1b',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          {mode.kind === 'idle' && (
            <Stack gap="4">
              <Button
                variant="primary"
                block
                onClick={() => {
                  setError(null)
                  setMode({ kind: 'placingVenuePoint' })
                }}
              >
                + New venue
              </Button>

              <div>
                <label
                  className="type-label-sm"
                  style={{ display: 'block', marginBottom: 'var(--space-2)' }}
                >
                  …or add a patio to an existing venue
                </label>
                <select
                  value={pickVenueId}
                  onChange={(e) => setPickVenueId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--theme-border)',
                    background: 'var(--theme-surface)',
                  }}
                >
                  <option value="">Pick a venue…</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ink"
                  block
                  disabled={!pickVenueId}
                  style={{ marginTop: 'var(--space-3)' }}
                  onClick={() => {
                    const v = venues.find((x) => x.id === pickVenueId)
                    if (!v) return
                    setError(null)
                    setMode({ kind: 'drawingPatio', venueId: v.id, venueName: v.name })
                  }}
                >
                  Draw patio for this venue
                </Button>
              </div>
            </Stack>
          )}

          {mode.kind === 'placingVenuePoint' && (
            <Stack gap="3">
              <p className="type-body-sm">Click anywhere on the map to drop a pin.</p>
              <Button variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </Stack>
          )}

          {mode.kind === 'venueForm' && (
            <Stack gap="4">
              <TextField
                label="Name"
                value={venueForm.name}
                onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                required
              />
              <TextField
                label="Address"
                value={venueForm.address}
                onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
              />
              <TextField
                label="Neighborhood"
                value={venueForm.neighborhood}
                onChange={(e) =>
                  setVenueForm({ ...venueForm, neighborhood: e.target.value })
                }
              />
              <TextField
                label="Website"
                type="url"
                value={venueForm.website}
                onChange={(e) => setVenueForm({ ...venueForm, website: e.target.value })}
              />
              <TextField
                label="Description"
                value={venueForm.description}
                onChange={(e) =>
                  setVenueForm({ ...venueForm, description: e.target.value })
                }
              />
              <Stack gap="2">
                <Toggle
                  label="Dog friendly"
                  checked={venueForm.dog_friendly}
                  onChange={(v) => setVenueForm({ ...venueForm, dog_friendly: v })}
                />
                <Toggle
                  label="Heated"
                  checked={venueForm.heated}
                  onChange={(v) => setVenueForm({ ...venueForm, heated: v })}
                />
                <Toggle
                  label="Covered"
                  checked={venueForm.covered}
                  onChange={(v) => setVenueForm({ ...venueForm, covered: v })}
                />
                <Toggle
                  label="Serves food"
                  checked={venueForm.food}
                  onChange={(v) => setVenueForm({ ...venueForm, food: v })}
                />
                <Toggle
                  label="Reservations"
                  checked={venueForm.reservations}
                  onChange={(v) => setVenueForm({ ...venueForm, reservations: v })}
                />
              </Stack>
              <Stack direction="row" gap="3">
                <Button variant="primary" onClick={submitVenue} disabled={busy}>
                  {busy ? 'Saving…' : 'Save & draw patio'}
                </Button>
                <Button variant="ghost" onClick={reset} disabled={busy}>
                  Cancel
                </Button>
              </Stack>
            </Stack>
          )}

          {mode.kind === 'drawingPatio' && (
            <Stack gap="3">
              <p className="type-body-sm">
                Drawing patio for <strong>{mode.venueName}</strong>. Click to add
                vertices, double-click to finish.
              </p>
              <Button variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </Stack>
          )}

          {mode.kind === 'patioForm' && (
            <Stack gap="4">
              <p className="type-body-sm">
                Patio for <strong>{mode.venueName}</strong>.
              </p>
              <TextField
                label="Label"
                placeholder="Front patio"
                value={patioForm.label}
                onChange={(e) => setPatioForm({ ...patioForm, label: e.target.value })}
              />
              <TextField
                label="Notes"
                placeholder="Faces west — afternoon sun…"
                value={patioForm.notes}
                onChange={(e) => setPatioForm({ ...patioForm, notes: e.target.value })}
              />
              <Stack gap="2">
                <Toggle
                  label="Umbrellas"
                  checked={patioForm.umbrellas}
                  onChange={(v) => setPatioForm({ ...patioForm, umbrellas: v })}
                />
                <Toggle
                  label="Awning"
                  checked={patioForm.awning}
                  onChange={(v) => setPatioForm({ ...patioForm, awning: v })}
                />
                <Toggle
                  label="Retractable roof"
                  checked={patioForm.retractable_roof}
                  onChange={(v) => setPatioForm({ ...patioForm, retractable_roof: v })}
                />
              </Stack>
              <Stack direction="row" gap="3">
                <Button variant="primary" onClick={submitPatio} disabled={busy}>
                  {busy ? 'Saving…' : 'Save patio'}
                </Button>
                <Button
                  variant="ink"
                  onClick={() =>
                    setMode({
                      kind: 'drawingPatio',
                      venueId: mode.venueId,
                      venueName: mode.venueName,
                    })
                  }
                  disabled={busy}
                >
                  Redraw
                </Button>
                <Button variant="ghost" onClick={reset} disabled={busy}>
                  Cancel
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </aside>
    </div>
  )
}

function hint(mode: Mode): string {
  switch (mode.kind) {
    case 'idle':
      return 'Drop a pin for a new venue, or pick an existing one to add a patio.'
    case 'placingVenuePoint':
      return 'Click on the map to place the venue pin.'
    case 'venueForm':
      return 'Fill in the venue details, then draw its patio.'
    case 'drawingPatio':
      return 'Draw the patio outline on the map.'
    case 'patioForm':
      return 'Add patio details, then save.'
  }
}

function MapClickListener({
  cursor,
  onClick,
}: {
  cursor: string | undefined
  onClick: (e: MapMouseEvent) => void
}) {
  const { current: map } = useMap()
  useEffect(() => {
    if (!map) return
    const m = map.getMap()
    const canvas = m.getCanvas()
    if (cursor) canvas.style.cursor = cursor
    else canvas.style.cursor = ''
    m.on('click', onClick)
    return () => {
      m.off('click', onClick)
      canvas.style.cursor = ''
    }
  }, [map, onClick, cursor])
  return null
}
