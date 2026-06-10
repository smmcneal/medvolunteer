'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import type { ShiftWithRoster } from './page'
import { updateShift, bulkUpdateRecurringShifts } from './actions'
import { useAdminT } from '@/lib/admin-lang'

const NAVY = '#1B2A4A'
const TEAL = '#00ACC1'

interface UpdateData {
  name?: string
  location_id?: string | null
  required_count?: number
  notes?: string
}

interface Props {
  shift: ShiftWithRoster
  updateData: UpdateData
  onClose: () => void
  onDone: () => void
}

export default function EditRecurringModal({ shift, updateData, onClose, onDone }: Props) {
  const t = useAdminT()
  const [choice, setChoice] = useState<'this' | 'future'>('this')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function confirm() {
    setError('')
    startTransition(async () => {
      try {
        if (choice === 'this') {
          await updateShift(shift.id, updateData)
        } else {
          await bulkUpdateRecurringShifts(shift.recurrence_group_id!, shift.id, updateData)
        }
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.5)',
          zIndex: 200, backdropFilter: 'blur(2px)',
        }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 201,
        background: 'var(--surface-card)', borderRadius: '14px',
        boxShadow: '0 24px 64px rgba(10,15,30,0.2)',
        border: '1px solid var(--surface-border)',
        width: '400px', maxWidth: 'calc(100vw - 32px)',
        padding: '26px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {t('edit_recurring_title')}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-faint)', padding: '4px', borderRadius: '6px',
          }}>
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
          {(['this', 'future'] as const).map(opt => (
            <label key={opt} style={{
              display: 'flex', alignItems: 'flex-start', gap: '11px',
              padding: '11px 13px', borderRadius: '9px', cursor: 'pointer',
              border: `2px solid ${choice === opt ? TEAL : 'var(--surface-border)'}`,
              background: choice === opt ? 'rgba(0,172,193,0.06)' : 'var(--surface-card)',
              transition: 'border-color 0.15s',
            }}>
              <input
                type="radio"
                checked={choice === opt}
                onChange={() => setChoice(opt)}
                style={{ marginTop: '2px', accentColor: TEAL }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {opt === 'this' ? t('this_shift_only') : t('this_and_future')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {opt === 'this' ? t('this_shift_only_desc') : t('this_and_future_desc')}
                </div>
              </div>
            </label>
          ))}
        </div>

        {error && <p style={{ fontSize: '13px', color: '#dc2626', marginBottom: '12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            border: '1px solid var(--surface-border)', background: 'var(--surface-card)',
            color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {t('cancel')}
          </button>
          <button
            onClick={confirm}
            disabled={isPending}
            style={{
              padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              border: 'none', background: TEAL, color: 'white',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            {isPending ? t('saving') : t('confirm')}
          </button>
        </div>
      </div>
    </>
  )
}
