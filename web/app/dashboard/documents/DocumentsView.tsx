'use client'

import { useRef, useState, useTransition } from 'react'
import { uploadOrgDocument, deleteOrgDocument, getOrgDocumentSignedUrl } from './actions'
import type { OrgDocument } from '@/types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCEPT = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain',
].join(',')

function formatBytes(bytes: number) {
  if (bytes === 0)          return ''
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileColor(mime: string): string {
  if (mime === 'application/pdf')                          return '#ef4444'
  if (mime.includes('word') || mime.includes('document')) return '#2563eb'
  if (mime.includes('excel') || mime.includes('sheet'))   return '#16a34a'
  if (mime.startsWith('image/'))                          return '#8b5cf6'
  return '#9ca3af'
}

function extBadge(name: string, mime: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : ''
  if (ext)                               return ext.slice(0, 4)
  if (mime === 'application/pdf')        return 'PDF'
  if (mime.startsWith('image/'))         return mime.split('/')[1].toUpperCase().slice(0, 4)
  return 'FILE'
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  initialDocs: OrgDocument[]
}

export default function DocumentsView({ initialDocs }: Props) {
  const [docs, setDocs]             = useState<OrgDocument[]>(initialDocs)
  const [uploading, setUploading]   = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef                = useRef<HTMLInputElement>(null)
  const [, startTransition]         = useTransition()

  const presetDocs  = docs.filter(d => d.is_preset).sort((a, b) => a.sort_order - b.sort_order)
  const uploadedDocs = docs.filter(d => !d.is_preset)

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)

    for (const file of Array.from(files)) {
      setUploadProgress(`Uploading ${file.name}…`)
      const fd = new FormData()
      fd.append('file', file)
      const result = await uploadOrgDocument(fd)
      if (result.error) {
        setError(result.error)
        setUploading(false)
        setUploadProgress(null)
        return
      }
      // Optimistic add
      setDocs(prev => [...prev, {
        id: crypto.randomUUID(),
        name: file.name,
        description: null,
        storage_path: '',
        public_path: null,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        is_preset: false,
        sort_order: 0,
        created_at: new Date().toISOString(),
      }])
    }

    setUploading(false)
    setUploadProgress(null)
    startTransition(() => {})
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(doc: OrgDocument) {
    if (!confirm(`Remove "${doc.name}"?`)) return
    setDeletingId(doc.id)
    const result = await deleteOrgDocument(doc.id, doc.storage_path)
    setDeletingId(null)
    if (result.error) { setError(result.error); return }
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  // ── View ────────────────────────────────────────────────────────────────────
  async function handleView(doc: OrgDocument) {
    if (doc.public_path) {
      window.open(doc.public_path, '_blank', 'noopener,noreferrer')
      return
    }
    if (!doc.storage_path) return
    const result = await getOrgDocumentSignedUrl(doc.storage_path)
    if (result.error || !result.url) { setError(result.error ?? 'Could not generate link'); return }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px' }}>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', marginBottom: '20px',
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
          fontSize: '13px', color: '#dc2626',
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}>✕</button>
        </div>
      )}

      {/* ── Preset Documents ── */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
          Standard Forms &amp; Disclosures
        </h2>
        <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
          These documents are automatically available to all volunteers in their portal.
        </p>
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
          {presetDocs.map((doc, i) => (
            <div
              key={doc.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 16px',
                borderTop: i > 0 ? '1px solid #f9fafb' : 'none',
              }}
            >
              {/* Icon */}
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                background: fileColor(doc.mime_type) + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 800, color: fileColor(doc.mime_type),
                letterSpacing: '0.02em',
              }}>
                {extBadge(doc.name, doc.mime_type)}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{doc.name}</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                  Standard form · Always visible to volunteers
                </p>
              </div>

              {/* Preset badge */}
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px',
                background: '#eff6ff', color: '#1d4ed8', flexShrink: 0,
              }}>
                Preset
              </span>

              {/* View button */}
              <button
                onClick={() => handleView(doc)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '7px 12px', borderRadius: '8px',
                  border: '1px solid #e5e7eb', background: 'white',
                  fontSize: '12px', fontWeight: 600, color: '#374151',
                  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                <OpenIcon /> Open
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Additional Documents ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Additional Documents
            </h2>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>
              Upload any extra documents — they&apos;ll appear in every volunteer&apos;s portal.
            </p>
          </div>

          {/* Upload button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              style={{ display: 'none' }}
              onChange={e => handleFiles(e.target.files)}
            />
            <button
              onClick={() => !uploading && fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '9px 16px', borderRadius: '9px',
                background: uploading ? '#9ca3af' : '#1B2A4A',
                border: 'none', color: 'white',
                fontSize: '13px', fontWeight: 600,
                cursor: uploading ? 'wait' : 'pointer',
                fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              {uploading ? (
                <><SpinnerIcon /> {uploadProgress ?? 'Uploading…'}</>
              ) : (
                <><UploadIcon /> Upload Document</>
              )}
            </button>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
          {uploadedDocs.length === 0 ? (
            <div style={{
              padding: '32px', textAlign: 'center',
              border: '2px dashed #f0f0f0', borderRadius: '12px',
              background: '#fafafa',
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>No additional documents yet</p>
              <p style={{ fontSize: '13px', color: '#9ca3af' }}>Upload PDFs, Word docs, spreadsheets, or images</p>
            </div>
          ) : (
            uploadedDocs.map((doc, i) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px',
                  borderTop: i > 0 ? '1px solid #f9fafb' : 'none',
                  opacity: deletingId === doc.id ? 0.45 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                  background: fileColor(doc.mime_type) + '15',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 800, color: fileColor(doc.mime_type),
                  letterSpacing: '0.02em',
                }}>
                  {extBadge(doc.name, doc.mime_type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.name}
                  </p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                    {formatBytes(doc.size_bytes)}{doc.size_bytes > 0 ? ' · ' : ''}
                    {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                {/* View */}
                <button
                  onClick={() => handleView(doc)}
                  title="Open"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '7px', borderRadius: '8px', color: '#9ca3af',
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                  }}
                >
                  <OpenIcon />
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                  title="Delete"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '7px', borderRadius: '8px', color: '#d1d5db',
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>
        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
          PDF, Word, Excel, PNG, JPG — up to 50 MB per file
        </p>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

function OpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/>
      <path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg style={{ animation: 'spin 0.85s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none">
      <style suppressHydrationWarning>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
