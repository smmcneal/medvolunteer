'use client'

import { useState, useTransition } from 'react'
import { applyTag, removeTag } from './actions'
import type { OrgTag } from '@/types/database'

export default function TagsPanel({
  volunteerId,
  appliedTags,
  orgTags,
}: {
  volunteerId: string
  appliedTags: { id: string; name: string; color: string }[]
  orgTags: OrgTag[]
}) {
  const [applied, setApplied] = useState(appliedTags)
  const [open, setOpen]       = useState(false)
  const [pending, startTransition] = useTransition()

  const available = orgTags.filter(t => !applied.some(a => a.id === t.id))

  function handleApply(tag: OrgTag) {
    setOpen(false)
    // Optimistic update first, roll back on error
    setApplied(a => [...a, { id: tag.id, name: tag.name, color: tag.color }])
    startTransition(async () => {
      const res = await applyTag(volunteerId, tag.id)
      if (res.error) setApplied(a => a.filter(t => t.id !== tag.id))
    })
  }

  function handleRemove(tagId: string) {
    // Optimistic update first, roll back on error
    const prev = applied.find(t => t.id === tagId)
    setApplied(a => a.filter(t => t.id !== tagId))
    startTransition(async () => {
      const res = await removeTag(volunteerId, tagId)
      if (res.error && prev) setApplied(a => [...a, prev])
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Tags</span>
        {available.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpen(v => !v)}
              disabled={pending}
              style={{ fontSize: 12, color: '#00897B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              + Add tag
            </button>
            {open && (
              <div style={{ position: 'absolute', right: 0, bottom: '110%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.1)', zIndex: 50, minWidth: 160 }}>
                {available.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleApply(tag)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#374151' }}>{tag.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {orgTags.length === 0 && (
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
          No tags defined yet.{' '}
          <a href="/dashboard/settings" style={{ color: '#14b8a6', textDecoration: 'none', fontWeight: 600 }}>
            Create tags in Settings →
          </a>
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {applied.length === 0 && orgTags.length > 0 && (
          <span style={{ fontSize: 13, color: '#9ca3af' }}>No tags applied.</span>
        )}
        {applied.map(tag => (
          <span key={tag.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 99,
            background: tag.color + '22', color: tag.color,
            fontSize: 12, fontWeight: 600, border: `1px solid ${tag.color}44`,
          }}>
            {tag.name}
            <button
              onClick={() => handleRemove(tag.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: tag.color, padding: 0, lineHeight: 1, fontSize: 14 }}
            >×</button>
          </span>
        ))}
      </div>
    </div>
  )
}
