'use client'

import { useState, useTransition } from 'react'
import { clockIn, clockOut } from './actions'

export default function ClockInButton({
  volunteerId,
  initialEntry,
}: {
  volunteerId: string
  initialEntry: { id: string; clock_in: string } | null
}) {
  const [entry, setEntry] = useState(initialEntry)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isClockedIn = !!entry

  function handleClick() {
    setError(null)
    startTransition(async () => {
      if (isClockedIn) {
        const res = await clockOut(entry.id, volunteerId)
        if (res.error) { setError(res.error); return }
        setEntry(null)
      } else {
        const res = await clockIn(volunteerId)
        if (res.error) { setError(res.error); return }
        setEntry({ id: res.entryId!, clock_in: new Date().toISOString() })
      }
    })
  }

  // How long they've been clocked in
  const elapsed = entry
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(entry.clock_in).getTime()) / 60000)
        const h = Math.floor(mins / 60)
        const m = mins % 60
        return h > 0 ? `${h}h ${m}m` : `${m}m`
      })()
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        onClick={handleClick}
        disabled={pending}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '8px 16px', borderRadius: 8, border: 'none',
          fontSize: '13px', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
          background: pending ? '#94a3b8' : isClockedIn ? '#fef2f2' : '#f0fdf4',
          color: pending ? '#fff' : isClockedIn ? '#dc2626' : '#15803d',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: pending ? '#94a3b8' : isClockedIn ? '#dc2626' : '#22c55e',
          animation: isClockedIn && !pending ? 'pulse 2s infinite' : 'none',
        }} />
        {pending ? (isClockedIn ? 'Clocking out…' : 'Clocking in…') : isClockedIn ? 'Clock Out' : 'Clock In'}
      </button>
      {isClockedIn && elapsed && (
        <span style={{ fontSize: '11px', color: '#9ca3af' }} suppressHydrationWarning>
          Clocked in {elapsed}
        </span>
      )}
      {error && (
        <span style={{ fontSize: '11px', color: '#dc2626' }}>{error}</span>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
