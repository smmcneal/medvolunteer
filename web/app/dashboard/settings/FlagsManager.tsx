'use client'

import { useState, useTransition } from 'react'
import { createFlag, deleteFlag } from './settingsActions'
import type { OrgFlag, FlagSeverity } from '@/types/database'

const PRESET_COLORS = [
  '#f59e0b', '#ef4444', '#0ea5e9', '#6366f1',
  '#10b981', '#8b5cf6', '#ec4899', '#64748b',
]

const SEVERITY_STYLES: Record<FlagSeverity, { bg: string; text: string; label: string }> = {
  info:     { bg: '#eff6ff', text: '#2563eb', label: 'Info' },
  warning:  { bg: '#fffbeb', text: '#d97706', label: 'Warning' },
  critical: { bg: '#fef2f2', text: '#dc2626', label: 'Critical' },
}

export default function FlagsManager({ initialFlags }: { initialFlags: OrgFlag[] }) {
  const [flags, setFlags]       = useState<OrgFlag[]>(initialFlags)
  const [name, setName]         = useState('')
  const [description, setDesc]  = useState('')
  const [severity, setSeverity] = useState<FlagSeverity>('warning')
  const [color, setColor]       = useState(PRESET_COLORS[0])
  const [error, setError]       = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    const res = await createFlag(name.trim(), description.trim(), severity, color)
    if (res.error) { setError(res.error); return }
    setFlags(f => [...f, {
      id: crypto.randomUUID(), org_id: '', name: name.trim(),
      description: description.trim() || null, severity, color, created_at: new Date().toISOString(),
    }])
    setName('')
    setDesc('')
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteFlag(id)
      setFlags(f => f.filter(flag => flag.id !== id))
    })
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 12 }}>Flags</h3>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        Alert-style markers for issues that need attention (e.g. "Reference not called", "License expiring").
      </p>

      {/* Existing flags */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {flags.length === 0 && (
          <span style={{ fontSize: 13, color: '#9ca3af' }}>No flags defined yet.</span>
        )}
        {flags.map(flag => {
          const sev = SEVERITY_STYLES[flag.severity]
          return (
            <div key={flag.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 8, background: '#f9fafb',
              border: '1px solid #f0f0f0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: flag.color, flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{flag.name}</span>
                  {flag.description && <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>{flag.description}</span>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: sev.bg, color: sev.text }}>
                  {sev.label}
                </span>
              </div>
              <button
                onClick={() => handleDelete(flag.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
              >×</button>
            </div>
          )
        })}
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Flag name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Reference not called"
              maxLength={60}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none' }}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Description (optional)</label>
            <input
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Short explanation"
              maxLength={120}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Severity</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['info', 'warning', 'critical'] as FlagSeverity[]).map(s => {
                const sev = SEVERITY_STYLES[s]
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    style={{
                      padding: '5px 12px', borderRadius: 6, border: severity === s ? `2px solid ${sev.text}` : '1px solid #e2e8f0',
                      background: severity === s ? sev.bg : '#fff',
                      color: severity === s ? sev.text : '#6b7280',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {sev.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Color</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', background: c, border: 'none',
                    cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={!name.trim() || pending}
            style={{
              padding: '8px 16px', borderRadius: 7, border: 'none',
              background: '#1B2A4A', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Add flag
          </button>
        </div>
      </form>
      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  )
}
