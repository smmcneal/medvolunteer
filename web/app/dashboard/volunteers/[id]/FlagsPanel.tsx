'use client'

import { useState, useTransition } from 'react'
import { raiseFlag, resolveFlag, unresolveFlag } from './actions'
import type { OrgFlag, VolunteerFlag, FlagSeverity } from '@/types/database'
import { useAdminT } from '@/lib/admin-lang'

const SEV_STYLES: Record<FlagSeverity, { bg: string; text: string; icon: string; border: string }> = {
  info:     { bg: '#eff6ff', text: '#2563eb', icon: 'ℹ', border: '#bfdbfe' },
  warning:  { bg: '#fffbeb', text: '#d97706', icon: '⚠', border: '#fde68a' },
  critical: { bg: '#fef2f2', text: '#dc2626', icon: '⛔', border: '#fecaca' },
}

export default function FlagsPanel({
  volunteerId,
  activeFlags,
  resolvedFlags,
  orgFlags,
}: {
  volunteerId: string
  activeFlags: (VolunteerFlag & { flag: OrgFlag })[]
  resolvedFlags: (VolunteerFlag & { flag: OrgFlag })[]
  orgFlags: OrgFlag[]
}) {
  const t = useAdminT()
  const [active, setActive]     = useState(activeFlags)
  const [resolved, setResolved] = useState(resolvedFlags)
  const [open, setOpen]         = useState(false)
  const [raisingFlag, setRaising] = useState<OrgFlag | null>(null)
  const [notes, setNotes]       = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleRaise(flag: OrgFlag) {
    setRaising(flag)
    setOpen(false)
    setNotes('')
  }

  function handleConfirmRaise() {
    if (!raisingFlag) return
    const flag = raisingFlag
    const tempId = crypto.randomUUID()
    const newEntry: VolunteerFlag & { flag: OrgFlag } = {
      id: tempId,
      volunteer_id: volunteerId,
      flag_id: flag.id,
      notes: notes || null,
      raised_at: new Date().toISOString(),
      resolved_at: null,
      resolved_by: null,
      flag,
    }
    // Optimistic update first
    setActive(a => [...a, newEntry])
    setRaising(null)
    startTransition(async () => {
      const res = await raiseFlag(volunteerId, flag.id, notes)
      if (res.error) setActive(a => a.filter(f => f.id !== tempId))
    })
  }

  function handleResolve(id: string) {
    const entry = active.find(f => f.id === id)
    if (!entry) return
    // Optimistic update first
    setActive(a => a.filter(f => f.id !== id))
    setResolved(r => [{ ...entry, resolved_at: new Date().toISOString() }, ...r])
    startTransition(async () => {
      const res = await resolveFlag(id, volunteerId)
      if (res.error) {
        // Roll back
        setActive(a => [...a, entry])
        setResolved(r => r.filter(f => f.id !== id))
      }
    })
  }

  function handleUnresolve(id: string) {
    const entry = resolved.find(f => f.id === id)
    if (!entry) return
    setResolved(r => r.filter(f => f.id !== id))
    setActive(a => [...a, { ...entry, resolved_at: null }])
    startTransition(async () => {
      const res = await unresolveFlag(id, volunteerId)
      if (res.error) {
        // Roll back
        setResolved(r => [...r, entry])
        setActive(a => a.filter(f => f.id !== id))
      }
    })
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{t('active_flags')}</span>
          {active.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#fef2f2', color: '#dc2626' }}>
              {active.length}
            </span>
          )}
        </div>
        {orgFlags.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpen(v => !v)}
              disabled={pending}
              style={{
                padding: '7px 14px', borderRadius: 7,
                border: '1px solid #e5e7eb', background: open ? '#f9fafb' : '#fff',
                fontSize: 13, fontWeight: 600, color: '#374151',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>⛳</span> {t('raise_flag')}
            </button>

            {open && (
              <>
                {/* Backdrop to close on outside click */}
                <div
                  onClick={() => setOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                />
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                  background: '#fff', border: '1px solid #e5e7eb',
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                  zIndex: 50, minWidth: 240, overflow: 'hidden',
                }}>
                  <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {t('select_flag_type')}
                    </span>
                  </div>
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {orgFlags.map((flag, i) => {
                      const sev = SEV_STYLES[flag.severity]
                      return (
                        <button
                          key={flag.id}
                          onClick={() => handleRaise(flag)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            width: '100%', padding: '10px 14px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            textAlign: 'left',
                            borderTop: i === 0 ? 'none' : '1px solid #f9f9f9',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <span style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: sev.bg, border: `1px solid ${sev.border}`,
                            fontSize: 14, marginTop: 1,
                          }}>
                            {sev.icon}
                          </span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{flag.name}</div>
                            {flag.description && (
                              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{flag.description}</div>
                            )}
                            <span style={{
                              display: 'inline-block', marginTop: 4,
                              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: '0.05em', padding: '1px 6px', borderRadius: 4,
                              background: sev.bg, color: sev.text,
                            }}>
                              {flag.severity}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Raise flag confirm modal */}
      {raisingFlag && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>
            {t('raise_flag')}: {raisingFlag.name}
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('optional_notes')}
            rows={2}
            style={{ width: '100%', padding: '8px', border: '1px solid #fde68a', borderRadius: 6, fontSize: 13, resize: 'none', marginBottom: 10, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleConfirmRaise} disabled={pending} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {t('raise_flag_btn')}
            </button>
            <button onClick={() => setRaising(null)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Active flags */}
      {active.length === 0 && !raisingFlag && (
        <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
          {orgFlags.length === 0 ? (
            <>
              {t('no_flag_types')}{' '}
              <a href="/dashboard/settings" style={{ color: '#14b8a6', textDecoration: 'none', fontWeight: 600 }}>
                {t('create_flags_in_settings')}
              </a>
            </>
          ) : t('no_active_flags')}
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {active.map(vf => {
          const sev = SEV_STYLES[vf.flag.severity]
          return (
            <div key={vf.id} style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{sev.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: sev.text }}>{vf.flag.name}</div>
                {vf.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{vf.notes}</div>}
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }} suppressHydrationWarning>
                  {t('raised')} {new Date(vf.raised_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => handleResolve(vf.id)}
                disabled={pending}
                style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', flexShrink: 0 }}
              >
                {t('resolve')}
              </button>
            </div>
          )
        })}
      </div>

      {/* Resolved flags (collapsible) */}
      {resolved.length > 0 && (
        <div>
          <button
            onClick={() => setShowResolved(v => !v)}
            style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8 }}
          >
            {showResolved ? `▲ ${t('hide')}` : `▼ ${t('show')}`} {resolved.length} {t(resolved.length !== 1 ? 'flags' : 'flag')} {t('resolved')}
          </button>
          {showResolved && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {resolved.map(vf => (
                <div key={vf.id} style={{ background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>✓</span>
                    <span style={{ fontSize: 13, color: '#6b7280', textDecoration: 'line-through' }}>{vf.flag.name}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }} suppressHydrationWarning>
                      {t('resolved')} {vf.resolved_at ? new Date(vf.resolved_at).toLocaleDateString() : ''}
                    </span>
                    <button
                      onClick={() => handleUnresolve(vf.id)}
                      disabled={pending}
                      style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}
                    >
                      {t('unresolve')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
