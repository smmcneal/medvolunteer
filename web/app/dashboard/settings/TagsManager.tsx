'use client'

import { useState, useTransition } from 'react'
import { createTag, deleteTag, updateTag } from './settingsActions'
import type { OrgTag } from '@/types/database'
import { useAdminT } from '@/lib/admin-lang'

const PRESET_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#64748b',
]

export default function TagsManager({ initialTags }: { initialTags: OrgTag[] }) {
  const t = useAdminT()
  const [tags, setTags]     = useState<OrgTag[]>(initialTags)
  const [name, setName]     = useState('')
  const [color, setColor]   = useState(PRESET_COLORS[0])
  const [error, setError]   = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [editColor, setEditColor] = useState(PRESET_COLORS[0])
  const [editError, setEditError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    const res = await createTag(name.trim(), color)
    if (res.error) { setError(res.error); return }
    // Optimistic: add placeholder; page revalidation will refresh
    setTags(t => [...t, { id: crypto.randomUUID(), org_id: '', name: name.trim(), color, created_at: new Date().toISOString() }])
    setName('')
  }

  function startEdit(tag: OrgTag) {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
    setEditError(null)
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    setEditError(null)
    const res = await updateTag(id, editName.trim(), editColor)
    if (res.error) { setEditError(res.error); return }
    setTags(prev => prev.map(tag => tag.id === id ? { ...tag, name: editName.trim(), color: editColor } : tag))
    setEditingId(null)
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTag(id)
      setTags(t => t.filter(tag => tag.id !== id))
    })
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 12 }}>{t('tags_section')}</h3>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        {t('tags_desc')}
      </p>

      {/* Existing tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {tags.length === 0 && (
          <span style={{ fontSize: 13, color: '#9ca3af' }}>{t('no_tags_yet')}</span>
        )}
        {tags.map(tag => (
          editingId === tag.id ? (
            <div key={tag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleSaveEdit(tag.id); if (e.key === 'Escape') setEditingId(null) }}
                maxLength={40}
                style={{ padding: '3px 8px', borderRadius: 6, border: '1.5px solid #6366f1', fontSize: 13, outline: 'none', width: 120 }}
              />
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditColor(c)}
                  style={{
                    width: 16, height: 16, borderRadius: '50%', background: c, border: 'none',
                    cursor: 'pointer', outline: editColor === c ? `2px solid ${c}` : 'none', outlineOffset: 2,
                  }}
                />
              ))}
              <button onClick={() => void handleSaveEdit(tag.id)} style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#1B2A4A', border: 'none', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>{t('save_label')}</button>
              <button onClick={() => setEditingId(null)} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>{t('cancel')}</button>
            </div>
          ) : (
            <span key={tag.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 99,
              background: tag.color + '22', color: tag.color,
              fontSize: 13, fontWeight: 600, border: `1px solid ${tag.color}44`,
            }}>
              {tag.name}
              <button
                onClick={() => startEdit(tag)}
                title={t('edit')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: tag.color, padding: 0, lineHeight: 1, fontSize: 12 }}
              >✎</button>
              <button
                onClick={() => handleDelete(tag.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: tag.color, padding: 0, lineHeight: 1, fontSize: 15 }}
              >×</button>
            </span>
          )
        ))}
      </div>
      {editError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{editError}</p>}

      {/* Create form */}
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{t('tag_name')}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Bilingual"
            maxLength={40}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none' }}
          />
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
          {t('add_tag_btn')}
        </button>
      </form>
      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  )
}
