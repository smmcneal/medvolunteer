'use client'

import { useState, useTransition } from 'react'
import { addNote } from './actions'
import type { VolunteerNote } from '@/types/database'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function NotesPanel({
  volunteerId,
  initialNotes,
}: {
  volunteerId: string
  initialNotes: VolunteerNote[]
}) {
  const [notes, setNotes] = useState<VolunteerNote[]>(initialNotes)
  const [content, setContent] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await addNote(volunteerId, content)
      if (res.error) { setError(res.error); return }
      setNotes(n => [{
        id: crypto.randomUUID(),
        volunteer_id: volunteerId,
        content: content.trim(),
        created_by: null,
        created_at: new Date().toISOString(),
      }, ...n])
      setContent('')
    })
  }

  return (
    <div>
      {/* Add note form */}
      <form onSubmit={handleAdd} style={{ marginBottom: 20 }}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
            borderRadius: 8, fontSize: 13, resize: 'vertical',
            fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box',
            outline: 'none', marginBottom: 8,
          }}
        />
        {error && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 6 }}>{error}</p>}
        <button
          type="submit"
          disabled={!content.trim() || pending}
          style={{
            padding: '7px 16px', borderRadius: 7, border: 'none',
            background: pending || !content.trim() ? '#94a3b8' : '#1B2A4A',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: pending || !content.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Saving…' : 'Add note'}
        </button>
      </form>

      {/* Notes feed */}
      {notes.length === 0 ? (
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>No notes yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notes.map(note => (
            <div key={note.id} style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f0f0f0' }}>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 6, whiteSpace: 'pre-wrap' }}>{note.content}</p>
              <p style={{ fontSize: 11, color: '#9ca3af' }} suppressHydrationWarning>
                {note.created_by ? 'Admin' : 'System'} · {timeAgo(note.created_at)}
                <span style={{ marginLeft: 6 }} suppressHydrationWarning>({new Date(note.created_at).toLocaleString()})</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
