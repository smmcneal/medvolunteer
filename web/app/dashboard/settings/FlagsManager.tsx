'use client'

import { useState, useTransition } from 'react'
import { createFlag, deleteFlag, updateFlag } from './settingsActions'
import type { OrgFlag, FlagSeverity } from '@/types/database'
import { useAdminT } from '@/lib/admin-lang'

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
  const t = useAdminT()
  const [flags, setFlags]       = useState<OrgFlag[]>(initialFlags)
  const [name, setName]         = useState('')
  const [description, setDesc]  = useState('')
  const [severity, setSeverity] = useState<FlagSeverity>('warning')
  const [color, setColor]       = useState(PRESET_COLORS[0])
  const [error, setError]       = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [editingId, setEditingId]         = useState<string | null>(null)
  const [editName, setEditName]           = useState('')
  const [editDescription, setEditDesc]    = useState('')
  const [editSeverity, setEditSeverity]   = useState<FlagSeverity>('warning')
  const [editColor, setEditColor]         = useState(PRESET_COLORS[0])
  const [editError, setEditError]         = useState<string | null>(null)

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

  function startEdit(flag: OrgFlag) {
    setEditingId(flag.id)
    setEditName(flag.name)
    setEditDesc(flag.description ?? '')
    setEditSeverity(flag.severity)
    setEditColor(flag.color)
    setEditError(null)
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    setEditError(null)
    const res = await updateFlag(id, editName.trim(), editDescription.trim(), editSeverity, editColor)
    if (res.error) { setEditError(res.error); return }
    setFlags(prev => prev.map(flag => flag.id === id
      ? { ...flag, name: editName.trim(), description: editDescription.trim() || null, severity: editSeverity, color: editColor }
      : flag))
    setEditingId(null)
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteFlag(id)
      setFlags(f => f.filter(flag => flag.id !== id))
    })
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 12 }}>{t('flags_section')}</h3>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        {t('flags_desc')}
      </p>

      {/* Existing flags */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {flags.length === 0 && (
          <span style={{ fontSize: 13, color: '#9ca3af' }}>{t('no_flags_yet')}</span>
        )}
        {flags.map(flag => {
          const sev = SEVERITY_STYLES[flag.severity]

          if (editingId === flag.id) {
            return (
              <div key={flag.id} style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                padding: '12px 14px', borderRadius: 8, background: '#f9fafb',
                border: '1.5px solid #6366f1',
              }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    maxLength={60}
                    style={{ flex: '1 1 180px', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none' }}
                  />
                  <input
                    value={editDescription}
                    onChange={e => setEditDesc(e.target.value)}
                    placeholder={t('flag_description')}
                    maxLength={120}
                    style={{ flex: '1 1 180px', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['info', 'warning', 'critical'] as FlagSeverity[]).map(s => {
                      const sevStyle = SEVERITY_STYLES[s]
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEditSeverity(s)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: editSeverity === s ? `2px solid ${sevStyle.text}` : '1px solid #e2e8f0',
                            background: editSeverity === s ? sevStyle.bg : '#fff',
                            color: editSeverity === s ? sevStyle.text : '#6b7280',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          {t(`severity_${s}`)}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        style={{
                          width: 18, height: 18, borderRadius: '50%', background: c, border: 'none',
                          cursor: 'pointer', outline: editColor === c ? `2px solid ${c}` : 'none', outlineOffset: 2,
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <button onClick={() => void handleSaveEdit(flag.id)} style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#1B2A4A', border: 'none', borderRadius: 5, padding: '5px 12px', cursor: 'pointer' }}>{t('save_label')}</button>
                    <button onClick={() => setEditingId(null)} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 5, padding: '5px 10px', cursor: 'pointer' }}>{t('cancel')}</button>
                  </div>
                </div>
                {editError && <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>{editError}</p>}
              </div>
            )
          }

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
                  {t(`severity_${flag.severity}`)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => startEdit(flag)}
                  style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 5, cursor: 'pointer', color: '#6b7280', fontSize: 11, fontWeight: 600, padding: '3px 8px' }}
                >{t('edit')}</button>
                <button
                  onClick={() => handleDelete(flag.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                >×</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{t('flag_name')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Reference not called"
              maxLength={60}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none' }}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{t('flag_description')}</label>
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
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{t('severity')}</label>
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
                    {t(`severity_${s}`)}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{t('color')}</label>
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
            {t('add_flag_btn')}
          </button>
        </div>
      </form>
      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  )
}
