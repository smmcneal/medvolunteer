'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AssignmentWithShift, AvailableShift, OrgLocation, TimeEntryRow } from './page'
import { volunteerClockIn, volunteerClockOut, volunteerSignUpForShift, volunteerDropShift, volunteerRequestReschedule } from './actions'
import RescheduleModal from './RescheduleModal'
import { useT } from '@/lib/volunteer-lang'

interface Props {
  assignments: AssignmentWithShift[]
  volunteerId: string
  orgId: string
  availableShifts: AvailableShift[]
  orgLocations: OrgLocation[]
}

type Tab = 'upcoming' | 'past'

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

const LOCATION_KEY = 'mv_selected_location'

export default function ShiftsView({ assignments, volunteerId, orgId, availableShifts, orgLocations }: Props) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('upcoming')

  // Persist selected location in localStorage — read after hydration to avoid mismatch
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  useEffect(() => {
    const stored = localStorage.getItem(LOCATION_KEY) ?? ''
    setSelectedLocationId(stored)
  }, [])

  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [clockingShiftId, setClockingShiftId] = useState<string | null>(null)
  const [signingUpShiftId, setSigningUpShiftId] = useState<string | null>(null)
  const [dropConfirmId, setDropConfirmId] = useState<string | null>(null)
  const [droppingAssignmentId, setDroppingAssignmentId] = useState<string | null>(null)
  const [moveAssignment, setMoveAssignment] = useState<AssignmentWithShift | null>(null)
  const [rescheduleAssignment, setRescheduleAssignment] = useState<AssignmentWithShift | null>(null)
  const [rescheduleSuccess, setRescheduleSuccess] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState<string | null>(null)
  const router = useRouter()

  const now = new Date().toISOString()
  const upcoming = assignments.filter(a => new Date(a.shift.end_time) >= new Date())
    .sort((a, b) => new Date(a.shift.start_time).getTime() - new Date(b.shift.start_time).getTime())
  const past = assignments.filter(a => new Date(a.shift.end_time) < new Date())
    .sort((a, b) => new Date(b.shift.start_time).getTime() - new Date(a.shift.start_time).getTime())

  // Filter available shifts by selected location
  const filteredAvailable = selectedLocationId
    ? availableShifts.filter(s => s.location_id === selectedLocationId)
    : availableShifts

  function handleLocationChange(locationId: string) {
    setSelectedLocationId(locationId)
    if (typeof window !== 'undefined') {
      if (locationId) {
        localStorage.setItem(LOCATION_KEY, locationId)
      } else {
        localStorage.removeItem(LOCATION_KEY)
      }
    }
  }

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

  function handleSignUp(shiftId: string, shiftName: string) {
    setActionError(null)
    setSigningUpShiftId(shiftId)
    startTransition(async () => {
      try {
        await volunteerSignUpForShift(shiftId)
        setSignUpSuccess(shiftName)
        setTimeout(() => setSignUpSuccess(null), 5000)
        router.refresh()
      } catch (e: unknown) {
        setActionError(e instanceof Error ? e.message : 'Sign-up failed')
      } finally {
        setSigningUpShiftId(null)
      }
    })
  }

  function handleDropShift(assignmentId: string) {
    setActionError(null)
    setDropConfirmId(null)
    setDroppingAssignmentId(assignmentId)
    startTransition(async () => {
      try {
        await volunteerDropShift(assignmentId)
        router.refresh()
      } catch (e: unknown) {
        setActionError(e instanceof Error ? e.message : 'Could not drop shift')
      } finally {
        setDroppingAssignmentId(null)
      }
    })
  }

  function handleRequestReschedule(a: AssignmentWithShift, note: string) {
    setActionError(null)
    startTransition(async () => {
      try {
        await volunteerRequestReschedule(a.id, note)
        setRescheduleAssignment(null)
        setRescheduleSuccess(true)
        setTimeout(() => setRescheduleSuccess(false), 4000)
      } catch (e: unknown) {
        setActionError(e instanceof Error ? e.message : 'Could not send request')
        setRescheduleAssignment(null)
      }
    })
  }

  const selectedLocation = orgLocations.find(l => l.id === selectedLocationId)

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#1B2A4A', padding: '52px 20px 20px', paddingTop: 'calc(52px + env(safe-area-inset-top))' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'white', margin: '0 0 12px' }}>{t('shifts_title')}</h1>

        {/* Location picker */}
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '14px' }}>📍</span>
          <select
            value={selectedLocationId}
            onChange={e => handleLocationChange(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: selectedLocationId ? 'white' : 'rgba(255,255,255,0.6)',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              padding: '8px 0',
              fontFamily: 'inherit',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            <option value="" style={{ color: '#374151' }}>{t('all_locations')}</option>
            {orgLocations.map(loc => (
              <option key={loc.id} value={loc.id} style={{ color: '#374151' }}>{loc.name}</option>
            ))}
          </select>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', pointerEvents: 'none' }}>▾</span>
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
          <>
            {/* Available shifts section */}
            {filteredAvailable.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{
                  fontSize: '11px', fontWeight: 700, color: '#00897B',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  margin: '0 0 10px',
                }}>
                  Available to Sign Up · {filteredAvailable.length}
                  {selectedLocation && (
                    <span style={{ color: '#9ca3af', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                      {' '}at {selectedLocation.name}
                    </span>
                  )}
                </p>
                {filteredAvailable.map(s => (
                  <AvailableShiftCard
                    key={s.id}
                    shift={s}
                    isSigningUp={signingUpShiftId === s.id && isPending}
                    onSignUp={() => handleSignUp(s.id, s.name)}
                  />
                ))}
              </div>
            )}

            {/* No available shifts for selected location */}
            {filteredAvailable.length === 0 && selectedLocationId && availableShifts.length > 0 && (
              <div style={{
                background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px',
                padding: '16px', marginBottom: '16px', textAlign: 'center',
              }}>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                  No open shifts at <strong>{selectedLocation?.name}</strong>
                </p>
              </div>
            )}

            {/* Sign-up success inline callout */}
            {signUpSuccess && (
              <div style={{
                background: '#ecfdf5', border: '1.5px solid #6ee7b7',
                borderRadius: '12px', padding: '12px 14px',
                marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <span style={{ fontSize: '18px' }}>✅</span>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#065f46', margin: 0 }}>
                    You&apos;re signed up!
                  </p>
                  <p style={{ fontSize: '12px', color: '#047857', margin: '2px 0 0' }}>
                    {signUpSuccess} has been added to your shifts below.
                  </p>
                </div>
              </div>
            )}

            {/* My assigned shifts */}
            {upcoming.length > 0 && (
              <p style={{
                fontSize: '11px', fontWeight: 700, color: '#6b7280',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                margin: '0 0 10px',
              }}>
                {t('my_shifts_label')} · {upcoming.length}
              </p>
            )}

            {upcoming.length === 0 && filteredAvailable.length === 0
              ? <EmptyState icon="📅" msg={t('no_shifts')} sub={t('no_shifts_sub')} />
              : upcoming.map(a => {
                  const canDrop = new Date(a.shift.start_time).getTime() - Date.now() > 24 * 60 * 60 * 1000
                  return (
                    <UpcomingCard
                      key={a.id}
                      assignment={a}
                      isClockedIn={!!a.openEntry}
                      isClockingIn={clockingShiftId === a.shift.id && isPending}
                      isClockingOut={!a.openEntry ? false : isPending}
                      onClockIn={() => handleClockIn(a)}
                      onClockOut={() => a.openEntry && handleClockOut(a.openEntry)}
                      canDrop={canDrop}
                      showDropConfirm={dropConfirmId === a.id}
                      isDroppingShift={droppingAssignmentId === a.id && isPending}
                      onDropRequest={() => setDropConfirmId(a.id)}
                      onDropConfirm={() => handleDropShift(a.id)}
                      onDropCancel={() => setDropConfirmId(null)}
                      onMoveRequest={() => setMoveAssignment(a)}
                      onRescheduleRequest={() => setRescheduleAssignment(a)}
                    />
                  )
                })
            }
          </>
        )}

        {tab === 'past' && (
          past.length === 0
            ? <EmptyState icon="🕐" msg={t('no_past_shifts')} sub={t('no_past_shifts_sub')} />
            : past.map(a => <PastCard key={a.id} assignment={a} />)
        )}
      </div>

      {/* Sign-up success toast */}
      {signUpSuccess && (
        <div style={{
          position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
          background: '#00897B', color: 'white', padding: '10px 18px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600, zIndex: 200,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 40px)', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          ✓ Signed up for {signUpSuccess}
        </div>
      )}

      {/* Reschedule request success toast */}
      {rescheduleSuccess && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#1B2A4A', color: 'white', padding: '10px 18px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600, zIndex: 200,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          ✓ Reschedule request sent
        </div>
      )}

      {/* Reschedule request modal */}
      {rescheduleAssignment && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setRescheduleAssignment(null) }}
        >
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '20px 20px 32px' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: '#e5e7eb', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1B2A4A', margin: '0 0 6px' }}>{t('reschedule')}</h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
              Your request will be sent to the admin for &ldquo;{rescheduleAssignment.shift.name}&rdquo;.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleRequestReschedule(rescheduleAssignment, '')}
                disabled={isPending}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: 'none', background: '#1B2A4A', color: 'white', cursor: isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                {isPending ? t('saving') : t('reschedule')}
              </button>
              <button
                onClick={() => setRescheduleAssignment(null)}
                style={{ padding: '11px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: '1px solid #e5e7eb', background: 'white', color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to different time modal */}
      {moveAssignment && (
        <RescheduleModal
          orgId={orgId}
          assignmentId={moveAssignment.id}
          shiftName={moveAssignment.shift.name}
          currentShiftId={moveAssignment.shift.id}
          onClose={() => setMoveAssignment(null)}
          onMoved={() => { setMoveAssignment(null); router.refresh() }}
        />
      )}
    </div>
  )
}

// ─── Upcoming shift card ───────────────────────────────────────────────────────

function UpcomingCard({
  assignment: a,
  isClockedIn,
  isClockingIn,
  isClockingOut,
  onClockIn,
  onClockOut,
  canDrop,
  showDropConfirm,
  isDroppingShift,
  onDropRequest,
  onDropConfirm,
  onDropCancel,
  onMoveRequest,
  onRescheduleRequest,
}: {
  assignment: AssignmentWithShift
  isClockedIn: boolean
  isClockingIn: boolean
  isClockingOut: boolean
  onClockIn: () => void
  onClockOut: () => void
  canDrop: boolean
  showDropConfirm: boolean
  isDroppingShift: boolean
  onDropRequest: () => void
  onDropConfirm: () => void
  onDropCancel: () => void
  onMoveRequest: () => void
  onRescheduleRequest: () => void
}) {
  const t = useT()
  const { shift } = a
  const active = isShiftActive(shift.start_time, shift.end_time)
  const loc = shift.locations

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
            </p>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              🕐 {formatDate(shift.start_time)} · {formatTime(shift.start_time)} – {formatTime(shift.end_time)} · {shiftDuration(shift.start_time, shift.end_time)}
            </p>
          </div>
        </div>

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
              {isClockingOut ? t('clocking_out') : `⏹  ${t('clock_out')}`}
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
              {isClockingIn ? t('clocking_in') : `▶  ${t('clock_in')}`}
            </button>
          )
        )}

        {/* Shift management actions (only for future, non-active shifts) */}
        {canDrop && !active && (
          showDropConfirm ? (
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={onDropConfirm}
                disabled={isDroppingShift}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1.5px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
              >
                {isDroppingShift ? t('saving') : t('yes_drop_shift')}
              </button>
              <button
                onClick={onDropCancel}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1.5px solid #e5e7eb', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}
              >
                {t('keep_shift')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={onMoveRequest}
                style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#1B2A4A', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t('move_shift')}
              </button>
              <button
                onClick={onRescheduleRequest}
                style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: '1px solid #e5e7eb', background: 'transparent', color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t('reschedule')}
              </button>
              <button
                onClick={onDropRequest}
                style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, border: '1px solid #e5e7eb', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t('drop_shift')}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ─── Available shift card ─────────────────────────────────────────────────────

function AvailableShiftCard({
  shift: s,
  isSigningUp,
  onSignUp,
}: {
  shift: AvailableShift
  isSigningUp: boolean
  onSignUp: () => void
}) {
  const loc = s.locations

  return (
    <div style={{
      background: 'white',
      border: '1.5px solid #d1fae5',
      borderRadius: '14px',
      marginBottom: '10px',
      overflow: 'hidden',
    }}>
      <div style={{ background: 'linear-gradient(90deg, #ecfdf5, #f0fdf4)', padding: '5px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#00897B', letterSpacing: '0.04em' }}>OPEN SHIFT</span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>
          {s.spots_left} of {s.required_count} spot{s.spots_left !== 1 ? 's' : ''} left
        </span>
      </div>

      <div style={{ padding: '14px' }}>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{s.name}</p>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 2px' }}>
          📍 {loc?.name ?? 'Unknown location'}
        </p>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px' }}>
          🕐 {formatDate(s.start_time)} · {formatTime(s.start_time)} – {formatTime(s.end_time)} · {shiftDuration(s.start_time, s.end_time)}
        </p>

        {s.notes && (
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 12px', fontStyle: 'italic' }}>{s.notes}</p>
        )}

        <button
          onClick={onSignUp}
          disabled={isSigningUp}
          style={{
            width: '100%', padding: '11px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
            border: 'none', background: isSigningUp ? '#e0f2f1' : '#00897B', color: 'white', cursor: 'pointer',
          }}
        >
          {isSigningUp ? 'Signing up…' : '+ Sign Up'}
        </button>
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
