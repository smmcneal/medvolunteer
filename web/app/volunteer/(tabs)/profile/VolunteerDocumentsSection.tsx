'use client'

import { useRef, useState, useTransition } from 'react'
import type { Document, VolunteerUpload } from '@/types/database'
import { uploadVolunteerDocument, deleteVolunteerUpload, getUploadSignedUrl } from './actions'
import { useT } from '@/lib/volunteer-lang'

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
  if (bytes < 1024)            return `${bytes} B`
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function extBadge(name: string, mime: string) {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : ''
  if (ext) return ext
  if (mime === 'application/pdf') return 'PDF'
  if (mime.startsWith('image/'))  return mime.split('/')[1].toUpperCase()
  return 'FILE'
}

function fileColor(mime: string): string {
  if (mime === 'application/pdf')                            return '#ef4444'
  if (mime.includes('word') || mime.includes('document'))   return '#2563eb'
  if (mime.includes('excel') || mime.includes('sheet'))     return '#16a34a'
  if (mime.startsWith('image/'))                            return '#8b5cf6'
  return '#9ca3af'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VolunteerDocumentsSection({
  volunteerId,
  uploads: initialUploads,
  signedDocuments,
}: {
  volunteerId: string
  uploads: VolunteerUpload[]
  signedDocuments: Document[]
}) {
  const t = useT()
  const [uploads, setUploads]       = useState<VolunteerUpload[]>(initialUploads)
  const [uploading, setUploading]   = useState(false)
  const [progress, setProgress]     = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef                = useRef<HTMLInputElement>(null)
  const [, startTransition]         = useTransition()

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)

    for (const file of Array.from(files)) {
      setProgress(`Uploading ${file.name}…`)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('volunteerId', volunteerId)
      const result = await uploadVolunteerDocument(fd)
      if (result.error) {
        setError(result.error)
        setUploading(false)
        setProgress(null)
        return
      }
      // Optimistically add the new file row
      setUploads(prev => [{
        id: crypto.randomUUID(),
        volunteer_id: volunteerId,
        name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        storage_path: '',   // revalidatePath will refresh with real path
        uploaded_by: null,
        uploaded_at: new Date().toISOString(),
        category: 'document',
      }, ...prev])
    }

    setUploading(false)
    setProgress(null)
    startTransition(() => { /* revalidatePath handles the refresh */ })
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(upload: VolunteerUpload) {
    setDeletingId(upload.id)
    const result = await deleteVolunteerUpload(upload.id, upload.storage_path)
    setDeletingId(null)
    if (result.error) { setError(result.error); return }
    setUploads(prev => prev.filter(u => u.id !== upload.id))
  }

  // ── View ──────────────────────────────────────────────────────────────────

  async function handleView(upload: VolunteerUpload) {
    const result = await getUploadSignedUrl(upload.storage_path)
    if (result.error || !result.url) { setError(result.error ?? 'Could not get download link'); return }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  // ─────────────────────────────────────────────────────────────────────────

  const isEmpty = uploads.length === 0 && signedDocuments.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Error banner */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: '8px',
          background: '#fef2f2', border: '1px solid #fecaca',
          fontSize: '13px', color: '#dc2626', gap: '8px',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', flexShrink: 0, padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Upload button ── */}
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
          width: '100%',
          padding: '13px',
          borderRadius: '12px',
          border: '2px dashed #e5e7eb',
          background: uploading ? '#f9fafb' : 'white',
          color: uploading ? '#9ca3af' : '#374151',
          fontSize: '14px',
          fontWeight: 600,
          cursor: uploading ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.15s',
        }}
      >
        {uploading ? (
          <>
            <SpinnerIcon />
            {progress ?? 'Uploading…'}
          </>
        ) : (
          <>
            <UploadIcon />
            {t('upload_doc')}
          </>
        )}
      </button>
      <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '-4px' }}>
        {t('credential_file_types')}
      </p>

      {/* ── Uploaded files ── */}
      {uploads.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #f0f0f0' }}>
          {uploads.map((u, i) => (
            <div
              key={u.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '13px 16px',
                background: 'white',
                borderTop: i > 0 ? '1px solid #f9fafb' : 'none',
                opacity: deletingId === u.id ? 0.45 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {/* File type dot */}
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                background: fileColor(u.mime_type) + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 800, color: fileColor(u.mime_type),
                letterSpacing: '0.02em',
              }}>
                {extBadge(u.name, u.mime_type).slice(0, 3)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '13px', fontWeight: 600, color: '#111827',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  margin: 0,
                }}>
                  {u.name}
                </p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                  {formatBytes(u.size_bytes)} · {formatDate(u.uploaded_at)}
                </p>
              </div>

              {/* View */}
              <button
                title="View / download"
                onClick={() => handleView(u)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px', borderRadius: '8px', color: '#9ca3af',
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                }}
              >
                <ExternalLinkIcon />
              </button>

              {/* Delete */}
              <button
                title="Remove"
                onClick={() => handleDelete(u)}
                disabled={deletingId === u.id}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px', borderRadius: '8px', color: '#d1d5db',
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Signed / onboarding documents ── */}
      {signedDocuments.length > 0 && (
        <>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '-4px', paddingLeft: '4px' }}>
            Signed Documents
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #f0f0f0' }}>
            {signedDocuments.map((d, i) => (
              <div
                key={d.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 16px', background: 'white',
                  borderTop: i > 0 ? '1px solid #f9fafb' : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <p style={{
                    fontSize: '13px', fontWeight: 600, color: '#111827',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0,
                  }}>
                    {d.name}
                  </p>
                  {d.signed_at && (
                    <p style={{ fontSize: '11px', color: '#16a34a', margin: '2px 0 0', fontWeight: 500 }}>
                      Signed {formatDate(d.signed_at)}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                    background: d.status === 'signed' ? '#f0fdf4' : d.status === 'expired' ? '#fef2f2' : '#f3f4f6',
                    color:      d.status === 'signed' ? '#15803d' : d.status === 'expired' ? '#dc2626' : '#6b7280',
                  }}>
                    {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                  </span>
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#9ca3af', display: 'flex', alignItems: 'center' }}
                    >
                      <ExternalLinkIcon />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {isEmpty && (
        <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>
          {t('no_docs_profile')}
        </p>
      )}

    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
    <svg style={{ animation: 'spin 0.85s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <style suppressHydrationWarning>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.15)" strokeWidth="2.5"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
