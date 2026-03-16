'use client'

import { useRef, useState, useTransition } from 'react'
import { Upload, FileText, FileImage, File, Trash2, ExternalLink, X } from 'lucide-react'
import type { Document, VolunteerUpload } from '@/types/database'
import {
  uploadVolunteerDocument,
  deleteVolunteerUpload,
  getUploadSignedUrl,
} from './actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCEPT = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
].join(',')

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function FileIcon({ mime }: { mime: string }) {
  const style = { width: '20px', height: '20px', flexShrink: 0 as const }
  if (mime.startsWith('image/'))          return <FileImage style={{ ...style, color: '#8b5cf6' }} />
  if (mime === 'application/pdf')         return <FileText  style={{ ...style, color: '#ef4444' }} />
  if (mime.includes('word') || mime.includes('document'))
                                          return <FileText  style={{ ...style, color: '#2563eb' }} />
  if (mime.includes('excel') || mime.includes('sheet'))
                                          return <FileText  style={{ ...style, color: '#16a34a' }} />
  return <File style={{ ...style, color: '#9ca3af' }} />
}

function extBadge(name: string, mime: string) {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : ''
  if (ext) return ext
  if (mime === 'application/pdf') return 'PDF'
  if (mime.startsWith('image/'))  return mime.split('/')[1].toUpperCase()
  return 'FILE'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentsPanel({
  volunteerId,
  uploads: initialUploads,
  signedDocuments,
}: {
  volunteerId: string
  uploads: VolunteerUpload[]
  signedDocuments: Document[]
}) {
  const [uploads, setUploads]         = useState<VolunteerUpload[]>(initialUploads)
  const [dragging, setDragging]       = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [uploadProgress, setProgress] = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const fileInputRef                  = useRef<HTMLInputElement>(null)
  const [, startTransition]           = useTransition()

  // ── Upload handler ─────────────────────────────────────────────────────────

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
    }

    setUploading(false)
    setProgress(null)
    // Optimistic: add a placeholder row until the server revalidates
    startTransition(() => { /* router.refresh() handled by revalidatePath */ })
  }

  // ── Delete handler ─────────────────────────────────────────────────────────

  async function handleDelete(upload: VolunteerUpload) {
    setDeletingId(upload.id)
    const result = await deleteVolunteerUpload(upload.id, upload.storage_path, volunteerId)
    setDeletingId(null)
    if (result.error) { setError(result.error); return }
    setUploads(prev => prev.filter(u => u.id !== upload.id))
  }

  // ── View / download handler ────────────────────────────────────────────────

  async function handleView(upload: VolunteerUpload) {
    const result = await getUploadSignedUrl(upload.storage_path)
    if (result.error || !result.url) { setError(result.error ?? 'Could not get download link'); return }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Error banner */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: '8px',
          background: '#fef2f2', border: '1px solid #fecaca',
          fontSize: '13px', color: '#dc2626',
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0 0 0 12px' }}>
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      )}

      {/* ── Drop zone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#14b8a6' : '#e5e7eb'}`,
          borderRadius: '12px',
          padding: '32px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          cursor: uploading ? 'wait' : 'pointer',
          background: dragging ? '#f0fdfa' : '#fafafa',
          transition: 'all 0.15s',
          userSelect: 'none',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: dragging ? '#ccfbf1' : '#f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}>
          <Upload style={{ width: '20px', height: '20px', color: dragging ? '#0d9488' : '#9ca3af' }} />
        </div>

        {uploading ? (
          <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>{uploadProgress}</p>
        ) : (
          <>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
              Drop files here, or <span style={{ color: '#14b8a6' }}>browse</span>
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>
              PDF, Word, Excel, PNG, JPG — up to 50 MB each
            </p>
          </>
        )}
      </div>

      {/* ── Uploaded files ── */}
      {uploads.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Uploaded Files ({uploads.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {uploads.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', borderRadius: '10px',
                border: '1px solid #f3f4f6', background: 'white',
                opacity: deletingId === u.id ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}>
                <FileIcon mime={u.mime_type} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '13px', fontWeight: 600, color: '#111827',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {u.name}
                  </p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    {formatBytes(u.size_bytes)} · {formatDate(u.uploaded_at)}
                  </p>
                </div>

                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '2px 6px',
                  borderRadius: '4px', background: '#f3f4f6', color: '#6b7280',
                  flexShrink: 0, letterSpacing: '0.04em',
                }}>
                  {extBadge(u.name, u.mime_type)}
                </span>

                {/* View / download */}
                <button
                  title="View / download"
                  onClick={() => handleView(u)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px', borderRadius: '6px', color: '#9ca3af',
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
                >
                  <ExternalLink style={{ width: '15px', height: '15px' }} />
                </button>

                {/* Delete */}
                <button
                  title="Delete file"
                  onClick={() => handleDelete(u)}
                  disabled={deletingId === u.id}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px', borderRadius: '6px', color: '#d1d5db',
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}
                >
                  <Trash2 style={{ width: '15px', height: '15px' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Signed / onboarding documents ── */}
      {signedDocuments.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Signed Documents ({signedDocuments.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {signedDocuments.map(d => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: '10px',
                border: '1px solid #f3f4f6', background: 'white',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileText style={{ width: '20px', height: '20px', color: '#9ca3af', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{d.name}</p>
                    {d.signed_at && (
                      <p style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
                        Signed {formatDate(d.signed_at)}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', color: '#9ca3af',
                        textDecoration: 'none',
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#374151')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9ca3af')}
                    >
                      <ExternalLink style={{ width: '15px', height: '15px' }} />
                    </a>
                  )}
                  <span style={{
                    fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px',
                    background: d.status === 'signed' ? '#f0fdf4' : d.status === 'expired' ? '#fef2f2' : '#f3f4f6',
                    color:      d.status === 'signed' ? '#15803d' : d.status === 'expired' ? '#dc2626' : '#6b7280',
                  }}>
                    {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {uploads.length === 0 && signedDocuments.length === 0 && (
        <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>
          No documents on file — upload one above
        </p>
      )}

    </div>
  )
}
