'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { AssignmentWithShift, TimeEntryRow } from './page'
import { volunteerClockIn, volunteerClockOut } from './actions'

interface Props {
  assignments: AssignmentWithShift[]
  volunteerId: string
}

type Tab = 'upcoming' | 'past'

interface GeoState {
  lat: number
  lng: number
  accuracy: number
}

// Haversine distance in meters
function distance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function shiftDuration(start: string, end: string) {
  const hrs = (new Date(end).getTime() - new Date(start).getTime()) / 3600000
  return hrs % 1 === 0 ? `${hrs}h` : `${hrs.toFixed(1)}h`
}

function isShiftActive(start: string, end: string) {
  const now = Date.now()
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return now >= s - 15 * 60000 && now <= e // 15 min before start to end
}

export default function ShiftsView({ assignments, volunteerId }: Props) {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [geo, setGeo] = useState<GeoState | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [clockingShiftId, setClockingShiftId] = useState<string | null>(null)
  const autoFiredRef = useRef<Set<string>>(new Set())
  const watchIdRef = useRef<number | null>(null)
  const router = useRouter()

  const now = new Date().toISOString()
  const upcoming = assignments.filter(a => new Date(a.shift.end_time) >= new Date())
    .sort((a, b) => new Date(a.shift.start_time).getTime() - new Date(b.shift.start_time).getTime())
  const past = assignments.filter(a => new Date(a.shift.end_time) < new Date())
    .sort((a, b) => new Date(b.shift.start_time).getTime() - new Date(a.shift.start_time).getTime())

  // ─── Geolocation ────────────────────────────────────────────────────────────

  function startGeolocation() {
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation not supported on this device')
      return
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null)
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeoError('Location access denied')
        else setGeoError('Unable to get location')
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    )
  }

  useEffect(() => {
    startGeolocation()
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  // ─── Auto clock-in on geofence entry ────────────────────────────────────────

  useEffect(() => {
    if (!geo) return

    for (const a of upcoming) {
      const loc = a.shift.locations
      if (!loc?.lat || !loc?.lng) continue
      if (a.openEntry) continue // already clocked in
      if (autoFiredRef.current.has(a.shift.id)) continue

      const dist = distance(geo.lat, geo.lng, loc.lat, loc.lng)
      const inFence = dist <= loc.geofence_radius_meters
      const active = isShiftActive(a.shift.start_time, a.shift.end_time)

      if (inFence && active) {
        autoFiredRef.current.add(a.shift.id)
        startTransition(async () => {
          try {
            await volunteerClockIn(a.shift.id, a.shift.location_id, 'geofence')
            router.refresh()
          } catch {
            autoFiredRef.current.delete(a.shift.id) // allow retry
          }
        })
      }
    }
  }, [geo])

  // ─── Manual clock in/out ────────────────────────────────────────────────────

  function handleClockIn(a: AssignmentWithShift) {
    setActionError(null)
    setClockingShiftId(a.shift.id)
    startTransition(async () => {
      try {
        await volunteerClockIn(a.shift.id, a.shift.location_id, 'manual')
        router.refresh()
      } catch (e: unknown) {
        setActionError(e instanceof Error ? e.message : 'Clock-in failed')
      } finally {
        setClockingShiftId(null)
      }
    })
  }

  function handleClockOut(entry: TimeEntryRow) {
    setActionError(null)
    startTransition(async () => {
      try {
        await volunteerClockOut(entry.id)
        router.refresh()
      } catch (e: unknown) {
        setActionError(e instanceof Error ? e.message : 'Clock-out failed')
      }
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#1B2A4A', padding: '52px 20px 20px', paddingTop: 'calc(52px + env(safe-area-inset-top))' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'white', margin: '0 0 12px' }}>My Shifts</h1>

        {/* Geolocation status strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '8px', padding: '7px 12px',
          fontSize: '12px', color: 'rgba(255,255,255,0.8)',
        }}>
          {geoError ? (
            <>
              <span>📍</span>
              <span style={{ color: '#fca5a5' }}>{geoError}</span>
              <button
                onClick={startGeolocation}
                style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '5px', padding: '2px 8px', color: 'white', fontSize: '11px', cursor: 'pointer' }}
              >Retry</button>
            </>
          ) : geo ? (
            <>
              <span>📍</span>
              <span style={{ color: '#6ee7b7' }}>Location active</span>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.5)' }}>±{Math.round(geo.accuracy)}m</span>
            </>
          ) : (
            <>
              <span>📍</span>
              <span>Getting location…</span>
            </>
          )}
        </div>
      </div>

      {/* Tab toggle */}
      <div style={{
        display: 'flex', background: 'white', borderBottom: '1px solid #f0f0f0',
        padding: '0 20px', gap: '4px',
      }}>
        {(['upcoming', 'past'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '12px 16px', border: 'none', background: 'transparent',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t ? '2px solid #1B2A4A' : '2px solid transparent',
            color: tab === t ? '#1B2A4A' : '#9ca3af',
            textTransform: 'capitalize',
          }}>{t} ({t === 'upcoming' ? upcoming.length : past.length})</button>
        ))}
      </div>

      {/* Error banner */}
      {actionError && (
        <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626' }}>
          {actionError}
        </div>
      )}

      {/* Shift list */}
      <div style={{ padding: '16px' }}>
        {tab === 'upcoming' && (
          upcoming.length === 0
            ? <EmptyState icon="📅" msg="No upcoming shifts" sub="Check with your coordinator for assignments" />
            : upcoming.map(a => (
                <UpcomingCard
                  key={a.id}
                  assignment={a}
                  geo={geo}
                  isClockedIn={!!a.openEntry}
                  isClockingIn={clockingShiftId === a.shift.id && isPending}
                  isClockingOut={!a.openEntry ? false : isPending}
                  onClockIn={() => handleClockIn(a)}
                  onClockOut={() => a.openEntry && handleClockOut(a.openEntry)}
                />
              ))
        )}

        {tab === 'past' && (
          past.length === 0
            ? <EmptyState icon="🕐" msg="No past shifts yet" sub="Completed shifts will appear here" />
            : past.map(a => <PastCard key={a.id} assignment={a} />)
        )}
      </div>
    </div>
  )
}

// ─── Upcoming shift card ───────────────────────────────────────────────────────

function UpcomingCard({
  assignment: a,
  geo,
  isClockedIn,
  isClockingIn,
  isClockingOut,
  onClockIn,
  onClockOut,
}: {
  assignment: AssignmentWithShift
  geo: GeoState | null
  isClockedIn: boolean
  isClockingIn: boolean
  isClockingOut: boolean
  onClockIn: () => void
  onClockOut: () => void
}) {
  const { shift } = a
  const active = isShiftActive(shift.start_time, shift.end_time)
  const loc = shift.locations

  // Compute distance to shift location
  const dist = (geo && loc?.lat && loc?.lng)
    ? distance(geo.lat, geo.lng, loc.lat, loc.lng)
    : null
  const inFence = dist !== null && dist <= (loc?.geofence_radius_meters ?? 100)

  const clockInTime = a.openEntry ? new Date(a.openEntry.clock_in) : null
  const elapsed = clockInTime
    ? Math.round((Date.now() - clockInTime.getTime()) / 60000)
    : null

  return (
    <div style={{
      background: 'white',
      border: `1.5px solid ${isClockedIn ? '#00897B' : active ? '#1B2A4A' : '#e5e7eb'}`,
      borderRadius: '14px',
      marginBottom: '10px',
      overflow: 'hidden',
    }}>
      {/* Active / clocked-in banner */}
      {isClockedIn && (
        <div style={{ background: '#00897B', padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>🟢 Clocked in</span>
          {elapsed !== null && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
              {elapsed < 60 ? `${elapsed}m` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`} elapsed
            </span>
          )}
        </div>
      )}
      {active && !isClockedIn && (
        <div style={{ background: '#1B2A4A', padding: '5px 14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', letterSpacing: '0.06em' }}>● ACTIVE NOW</span>
        </div>
      )}

      <div style={{ padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{shift.name}</p>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 2px' }}>
              📍 {loc?.name ?? 'Unknown location'}
              {dist !== null && (
                <span style={{ marginLeft: '6px', color: inFence ? '#00897B' : '#9ca3af', fontWeight: 600 }}>
                  ({dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
                  {inFence ? ' · In range ✓' : ''})
                </span>
              )}
            </p>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              🕐 {formatDate(shift.start_time)} · {formatTime(shift.start_time)} – {formatTime(shift.end_time)} · {shiftDuration(shift.start_time, shift.end_time)}
            </p>
          </div>
        </div>

        {/* Geofence auto-clock-in hint */}
        {active && !isClockedIn && inFence && (
          <p style={{ fontSize: '12px', color: '#00897B', fontWeight: 600, margin: '0 0 10px' }}>
            ✓ You're within range — auto clock-in will trigger
          </p>
        )}

        {shift.notes && (
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 10px', fontStyle: 'italic' }}>{shift.notes}</p>
        )}

        {/* Clock in / out buttons (only for active window) */}
        {active && (
          isClockedIn ? (
            <button
              onClick={onClockOut}
              disabled={isClockingOut}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                border: '2px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer',
              }}
            >
              {isClockingOut ? 'Clocking out…' : '⏹  Clock Out'}
            </button>
          ) : (
            <button
              onClick={onClockIn}
              disabled={isClockingIn}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                border: 'none', background: '#1B2A4A', color: 'white', cursor: 'pointer',
              }}
            >
              {isClockingIn ? 'Clocking in…' : '▶  Clock In'}
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ─── Past shift card ───────────────────────────────────────────────────────────

function PastCard({ assignment: a }: { assignment: AssignmentWithShift }) {
  const { shift } = a
  const totalMins = a.pastEntries.reduce((sum, te) => sum + (te.duration_minutes ?? 0), 0)
  const hours = totalMins > 0 ? (totalMins / 60).toFixed(1) : null

  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb',
      borderRadius: '14px', padding: '14px', marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#374151', margin: '0 0 4px' }}>{shift.name}</p>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 2px' }}>
            📍 {shift.locations?.name ?? 'Unknown location'}
          </p>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
            {formatDate(shift.start_time)} · {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
          </p>
        </div>
        {hours !== null ? (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '20px', fontWeight: 800, color: '#00897B', margin: 0, lineHeight: 1 }}>{hours}h</p>
            <p style={{ fontSize: '10px', color: '#9ca3af', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>worked</p>
          </div>
        ) : (
          <span style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', flexShrink: 0 }}>No record</span>
        )}
      </div>
      {a.pastEntries.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
          {a.pastEntries.map(te => (
            <span key={te.id} style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '99px',
              background: '#f3f4f6', color: '#6b7280',
            }}>
              {formatTime(te.clock_in)}–{te.clock_out ? formatTime(te.clock_out) : '?'}
              {' '}· {te.method}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon, msg, sub }: { icon: string; msg: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: '40px', marginBottom: '10px' }}>{icon}</div>
      <p style={{ fontSize: '15px', fontWeight: 700, color: '#374151', margin: '0 0 4px' }}>{msg}</p>
      <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>{sub}</p>
    </div>
  )
}
