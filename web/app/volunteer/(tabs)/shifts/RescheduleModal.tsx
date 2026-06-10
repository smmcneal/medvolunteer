'use client'

import { useState, useEffect } from 'react'
import { volunteerMoveShift, getRescheduleOptions, type RescheduleOption } from './actions'
import { useT } from '@/lib/volunteer-lang'

type ShiftOption = RescheduleOption

interface Props {
  /** Kept for call-site compatibility; org scoping now happens server-side. */
  orgId?: string
  assignmentId: string
  shiftName: string
  currentShiftId: string
  onClose: () => void
  onMoved: (oldShiftId: string, oldAssignmentId: string, newShiftId: string, newAssignmentId: string) => void
}

function formatShiftTime(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dateStr} · ${startTime} – ${endTime}`
}

export default function RescheduleModal({
  assignmentId, shiftName, currentShiftId, onClose, onMoved,
}: Props) {
  const t = useT()
  const [options, setOptions] = useState<ShiftOption[]>([])
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOptions() {
      try {
        const opts = await getRescheduleOptions(shiftName, currentShiftId)
        setOptions(opts)
      } catch {
        // leave options empty — the modal shows its "no options" state
      }
      setLoading(false)
    }
    fetchOptions()
  }, [shiftName, currentShiftId])

  async function handleMove(newShiftId: string) {
    setMoving(newShiftId)
    setError(null)
    try {
      const { newAssignmentId } = await volunteerMoveShift(assignmentId, newShiftId)
      onMoved(currentShiftId, assignmentId, newShiftId, newAssignmentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move shift. Please try again.')
      setMoving(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'white',
        borderRadius: '20px 20px 0 0',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '80vh',
        overflowY: 'auto',
        padding: '20px 20px 32px',
      }}>
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: '#e5e7eb', margin: '0 auto 16px' }} />

        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1B2A4A', margin: '0 0 4px' }}>
          {t('move_shift')}
        </h2>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 18px' }}>
          Available times for &ldquo;{shiftName}&rdquo;
        </p>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '13px', color: '#991b1b', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Loading…</p>
        ) : options.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
            No other available times for this shift.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {options.map(opt => (
              <div key={opt.id} style={{
                border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1B2A4A', margin: '0 0 3px' }}>
                    {formatShiftTime(opt.start_time, opt.end_time)}
                  </p>
                  {opt.location_name && (
                    <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 3px' }}>📍 {opt.location_name}</p>
                  )}
                  {opt.spots_left !== null && (
                    <p style={{ fontSize: '11px', color: opt.spots_left <= 2 ? '#f59e0b' : '#9ca3af', margin: 0 }}>
                      {opt.spots_left} spot{opt.spots_left !== 1 ? 's' : ''} left
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleMove(opt.id)}
                  disabled={moving === opt.id}
                  style={{
                    padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                    border: 'none', background: moving === opt.id ? '#9ca3af' : '#1B2A4A',
                    color: 'white', cursor: moving === opt.id ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', flexShrink: 0,
                  }}
                >
                  {moving === opt.id ? t('moving') : t('select_time')}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: '16px', padding: '11px',
            borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            border: '1px solid #e5e7eb', background: 'white', color: '#374151',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}
