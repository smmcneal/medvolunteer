'use client'

import { useState, useTransition } from 'react'
import { updatePipelinePhase } from './actions'
import type { PipelinePhase } from '@/types/database'
import { useAdminT } from '@/lib/admin-lang'

const NAVY = '#1B2A4A'
const TEAL = '#00897B'

const PHASES: { key: PipelinePhase; label: string; description: string }[] = [
  { key: 'intake',       label: 'Intake',       description: 'Application received and under review' },
  { key: 'orientation',  label: 'Orientation',  description: 'Invited to in-person clinic orientation' },
  { key: 'review',       label: 'Review',       description: 'Background check, CV, license, reference' },
  { key: 'training',     label: 'Training',     description: 'First shift with an experienced mentor' },
  { key: 'active',       label: 'Active',       description: 'Cleared to volunteer independently' },
  { key: 'offboarding',  label: 'Offboarding',  description: 'No longer participating' },
]

const PHASE_ORDER = PHASES.map(p => p.key)

export default function PipelinePhaseBar({
  volunteerId,
  currentPhase,
}: {
  volunteerId: string
  currentPhase: PipelinePhase
}) {
  const t = useAdminT()
  const [phase, setPhase] = useState<PipelinePhase>(currentPhase)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showOverride, setShowOverride] = useState(false)

  const currentIndex = PHASE_ORDER.indexOf(phase)
  const nextPhase = currentIndex < PHASE_ORDER.length - 1 ? PHASE_ORDER[currentIndex + 1] : null
  const currentMeta = PHASES.find(p => p.key === phase)!

  function handleAdvance() {
    if (!nextPhase) return
    startTransition(async () => {
      setError(null)
      const res = await updatePipelinePhase(volunteerId, nextPhase)
      if (res.error) { setError(res.error); return }
      setPhase(nextPhase)
    })
  }

  function handleOverride(newPhase: PipelinePhase) {
    setShowOverride(false)
    startTransition(async () => {
      setError(null)
      const res = await updatePipelinePhase(volunteerId, newPhase)
      if (res.error) { setError(res.error); return }
      setPhase(newPhase)
    })
  }

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20, overflowX: 'auto' }}>
        {PHASES.map((p, i) => {
          const idx = PHASE_ORDER.indexOf(phase)
          const isDone    = i < idx
          const isCurrent = i === idx
          const isFuture  = i > idx

          return (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', flex: i < PHASES.length - 1 ? '1' : undefined }}>
              {/* Node */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 64 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDone ? NAVY : isCurrent ? TEAL : '#f3f4f6',
                  border: isFuture ? '2px solid #e5e7eb' : 'none',
                  flexShrink: 0,
                }}>
                  {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: isCurrent ? '#fff' : '#9ca3af' }}>{i + 1}</span>
                  )}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: isCurrent ? 700 : 500,
                  color: isDone ? NAVY : isCurrent ? TEAL : '#9ca3af',
                  whiteSpace: 'nowrap',
                }}>
                  {p.label}
                </span>
              </div>
              {/* Connector */}
              {i < PHASES.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < PHASE_ORDER.indexOf(phase) ? NAVY : '#e5e7eb', margin: '0 4px', marginBottom: 22 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Current phase description + controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            <strong style={{ color: '#111827' }}>{currentMeta.label}:</strong>{' '}
            {currentMeta.description}
          </div>
          {error && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{error}</p>}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Override dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowOverride(v => !v)}
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}
            >
              {t('override')} ▾
            </button>
            {showOverride && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.1)', zIndex: 50, minWidth: 160 }}>
                {PHASES.filter(p => p.key !== phase).map(p => (
                  <button
                    key={p.key}
                    onClick={() => handleOverride(p.key)}
                    style={{ display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#374151' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Advance button */}
          {nextPhase && (
            <button
              onClick={handleAdvance}
              disabled={pending}
              style={{
                padding: '7px 14px', borderRadius: 7, border: 'none',
                background: pending ? '#94a3b8' : TEAL, color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? t('saving') : `${t('advance_to')} ${PHASES[PHASE_ORDER.indexOf(phase) + 1]?.label} →`}
            </button>
          )}
          {!nextPhase && (
            <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>{t('final_phase')}</span>
          )}
        </div>
      </div>
    </div>
  )
}
