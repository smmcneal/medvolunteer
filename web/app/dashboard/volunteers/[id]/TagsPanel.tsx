'use client'

import { useState, useTransition } from 'react'
import { applyTag, removeTag } from './actions'
import type { OrgTag } from '@/types/database'
import { useAdminT } from '@/lib/admin-lang'

export default function TagsPanel({
  volunteerId,
  appliedTags,
  orgTags,
}: {
  volunteerId: string
  appliedTags: { id: string; name: string; color: string }[]
  orgTags: OrgTag[]
}) {
  const t = useAdminT()
  const [applied, setApplied] = useState(appliedTags)
  const [open, setOpen]       = useState(false)
  const [pending, startTransition] = useTransition()

  const available = orgTags.filter(tag => !applied.some(a => a.id === tag.id))

  function handleApply(tag: OrgTag) {
    setOpen(false)
    // Optimistic update first, roll back on error
    setApplied(a => [...a, { id: tag.id, name: tag.name, color: tag.color }])
    startTransition(async () => {
      const res = await applyTag(volunteerId, tag.id)
      if (res.error) setApplied(a => a.filter(item => item.id !== tag.id))
    })
  }

  function handleRemove(tagId: string) {
    // Optimistic update first, roll back on error
    const prev = applied.find(item => item.id === tagId)
    setApplied(a => a.filter(item => item.id !== tagId))
    startTransition(async () => {
      const res = await removeTag(volunteerId, tagId)
      if (res.error && prev) setApplied(a => [...a, prev!])
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{t('tags_label')}</span>
        {available.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpen(v => !v)}
              disabled={pending}
              style={{
                fontSize: 12, color: '#00897B', background: 'none', border: 'none',
                cursor: 'pointer', fontWeight: 600, padding: '2px 0',
              }}
            >
              {t('add_tag')}
            </button>
            {open && (
              <>
                <div
                  onClick={() => setOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                />
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                  background: '#fff', border: '1px solid #e5e7eb',
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                  zIndex: 50, minWidth: 180, overflow: 'hidden', maxHeight: 240, overflowY: 'auto',
                }}>
                  {available.map((tag, i) => (
                    <button
                      key={tag.id}
                      onClick={() => handleApply(tag)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '9px 14px',
                        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                        borderTop: i === 0 ? 'none' : '1px solid #f9f9f9',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{tag.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {orgTags.length === 0 && (
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
          {t('no_tags_defined')}{' '}
          <a href="/dashboard/settings" style={{ color: '#14b8a6', textDecoration: 'none', fontWeight: 600 }}>
            {t('create_tags_in_settings')}
          </a>
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {applied.length === 0 && orgTags.length > 0 && (
          <span style={{ fontSize: 13, color: '#9ca3af' }}>{t('no_tags_applied')}</span>
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
