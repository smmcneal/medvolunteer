'use client'

import { useRef, useState, useTransition } from 'react'
import {
  uploadOrgDocument, uploadAdminDocument,
  deleteOrgDocument, getOrgDocumentSignedUrl,
  toggleDocumentVisibility,
} from './actions'
import type { OrgDocument } from '@/types/database'
import { useAdminT } from '@/lib/admin-lang'

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

// ─── Doc row ──────────────────────────────────────────────────────────────────

function DocRow({
  doc, index, deletingId, togglingId,
  onView, onDelete, onToggleVisibility,
  showPresetBadge = false,
  showAdminBadge  = false,
}: {
  doc: OrgDocument
  index: number
  deletingId: string | null
  togglingId: string | null
  onView: (doc: OrgDocument) => void
  onDelete?: (doc: OrgDocument) => void
  onToggleVisibility?: (doc: OrgDocument, visible: boolean) => void
  showPresetBadge?: boolean
  showAdminBadge?:  boolean
}) {
  const t = useAdminT()
  const color    = fileColor(doc.mime_type)
  const isHidden = onToggleVisibility && !doc.volunteer_visible

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '14px 16px',
      borderTop: index > 0 ? '1px solid var(--surface-border-sub)' : 'none',
      opacity: (deletingId === doc.id || togglingId === doc.id) ? 0.5 : 1,
      transition: 'opacity 0.15s',
      background: isHidden ? 'rgba(156,163,175,0.04)' : 'transparent',
    }}>

      {/* File type icon */}
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
        background: isHidden ? '#f3f4f6' : (color + '15'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', fontWeight: 800,
        color: isHidden ? '#9ca3af' : color,
        letterSpacing: '0.02em',
        transition: 'background 0.2s, color 0.2s',
      }}>
        {extBadge(doc.name, doc.mime_type)}
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
          <p style={{
            fontSize: '14px', fontWeight: 600, margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: isHidden ? 'var(--text-muted)' : 'var(--text-primary)',
            transition: 'color 0.2s',
          }}>
            {doc.name}
          </p>
          {isHidden && (
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '99px',
              background: '#f3f4f6', color: '#6b7280',
              textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
            }}>
              {t('hidden')}
            </span>
          )}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
          {showPresetBadge
            ? t('standard_form')
            : `${formatBytes(doc.size_bytes)}${doc.size_bytes > 0 ? ' · ' : ''}${new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
          }
        </p>
      </div>

      {/* Preset badge */}
      {showPresetBadge && (
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px',
          background: '#eff6ff', color: '#1d4ed8', flexShrink: 0,
        }}>
          {t('preset')}
        </span>
      )}

      {/* Internal badge */}
      {showAdminBadge && (
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px',
          background: 'rgba(245,158,11,0.1)', color: '#92400e', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <LockIcon /> {t('internal')}
        </span>
      )}

      {/* Visibility toggle (volunteer repo only) */}
      {onToggleVisibility && (
        <button
          onClick={() => onToggleVisibility(doc, !doc.volunteer_visible)}
          disabled={togglingId === doc.id}
          title={doc.volunteer_visible ? 'Visible to volunteers — click to hide' : 'Hidden from volunteers — click to show'}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 10px', borderRadius: '7px', border: '1px solid',
            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            fontSize: '11px', fontWeight: 600,
            background: doc.volunteer_visible ? 'rgba(0,137,123,0.06)' : '#f9fafb',
            borderColor: doc.volunteer_visible ? 'rgba(0,137,123,0.25)' : '#e5e7eb',
            color: doc.volunteer_visible ? 'var(--teal)' : '#9ca3af',
            transition: 'all 0.15s',
          }}
        >
          {doc.volunteer_visible ? <EyeIcon /> : <EyeOffIcon />}
          {doc.volunteer_visible ? t('visible') : t('hidden')}
        </button>
      )}

      {/* View */}
      <button
        onClick={() => onView(doc)}
        title="Open"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '7px', borderRadius: '8px', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}
      >
        <OpenIcon />
      </button>

      {/* Delete */}
      {onDelete && (
        <button
          onClick={() => onDelete(doc)}
          disabled={deletingId === doc.id}
          title="Delete"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '7px', borderRadius: '8px', color: 'var(--text-faint)',
            display: 'flex', alignItems: 'center', flexShrink: 0,
          }}
        >
          <TrashIcon />
        </button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialDocs: OrgDocument[]
}

export default function DocumentsView({ initialDocs }: Props) {
  const t = useAdminT()
  const [docs, setDocs]                     = useState<OrgDocument[]>(initialDocs)
  const [uploading, setUploading]           = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [adminUploading, setAdminUploading] = useState(false)
  const [adminUploadProgress, setAdminUploadProgress] = useState<string | null>(null)
  const [error, setError]                   = useState<string | null>(null)
  const [deletingId, setDeletingId]         = useState<string | null>(null)
  const [togglingId, setTogglingId]         = useState<string | null>(null)
  const fileInputRef                        = useRef<HTMLInputElement>(null)
  const adminFileInputRef                   = useRef<HTMLInputElement>(null)
  const [, startTransition]                 = useTransition()

  // Three buckets:
  // 1. preset: is_preset=true
  // 2. volunteer repo: is_internal=false, !is_preset (visibility may vary)
  // 3. internal: is_internal=true
  const presetDocs   = docs.filter(d => d.is_preset).sort((a, b) => a.sort_order - b.sort_order)
  const volunteerDocs = docs.filter(d => !d.is_preset && !d.is_internal)
  const internalDocs  = docs.filter(d => d.is_internal)

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function handleFiles(
    files: FileList | null,
    uploadFn: (fd: FormData) => Promise<{ error?: string }>,
    setUploadingState: (v: boolean) => void,
    setProgressState: (v: string | null) => void,
    isInternal: boolean,
  ) {
    if (!files || files.length === 0) return
    setError(null)
    setUploadingState(true)

    for (const file of Array.from(files)) {
      setProgressState(`Uploading ${file.name}…`)
      const fd = new FormData()
      fd.append('file', file)
      const result = await uploadFn(fd)
      if (result.error) {
        setError(result.error)
        setUploadingState(false)
        setProgressState(null)
        return
      }
      setDocs(prev => [...prev, {
        id: crypto.randomUUID(),
        name: file.name,
        description: null,
        storage_path: '',
        public_path: null,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        is_preset: false,
        volunteer_visible: !isInternal,
        is_internal: isInternal,
        sort_order: 0,
        created_at: new Date().toISOString(),
      }])
    }

    setUploadingState(false)
    setProgressState(null)
    startTransition(() => {})
  }

  // ── Toggle visibility ───────────────────────────────────────────────────────
  async function handleToggleVisibility(doc: OrgDocument, visible: boolean) {
    setTogglingId(doc.id)
    // Optimistic update
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, volunteer_visible: visible } : d))
    const result = await toggleDocumentVisibility(doc.id, visible)
    setTogglingId(null)
    if (result.error) {
      // Revert on failure
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, volunteer_visible: !visible } : d))
      setError(result.error)
    }
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
    if (doc.public_path) { window.open(doc.public_path, '_blank', 'noopener,noreferrer'); return }
    if (!doc.storage_path) return
    const result = await getOrgDocumentSignedUrl(doc.storage_path)
    if (result.error || !result.url) { setError(result.error ?? 'Could not generate link'); return }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  const sharedRowProps = { deletingId, togglingId, onView: handleView }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px' }}>

      {/* Error banner */}
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

      {/* ── 1. Standard Forms & Disclosures ── */}
      <section style={{ marginBottom: '36px' }}>
        <SectionHeader
          title={t('preset_docs')}
          description={t('standard_form')}
        />
        <div style={{ background: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
          {presetDocs.map((doc, i) => (
            <DocRow key={doc.id} doc={doc} index={i} {...sharedRowProps} showPresetBadge />
          ))}
        </div>
      </section>

      {/* ── 2. Volunteer Repository ── */}
      <section style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              {t('volunteer_repo')}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {t('visible')} / {t('hidden')}
            </p>
          </div>
          <input ref={fileInputRef} type="file" accept={ACCEPT} multiple style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files, uploadOrgDocument, setUploading, setUploadProgress, false)} />
          <UploadButton uploading={uploading} progress={uploadProgress} onClick={() => !uploading && fileInputRef.current?.click()} />
        </div>

        <div style={{ background: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
          {volunteerDocs.length === 0 ? (
            <EmptyState label={t('no_documents_found')} hint={t('drop_files_sub')} />
          ) : (
            volunteerDocs.map((doc, i) => (
              <DocRow
                key={doc.id} doc={doc} index={i}
                {...sharedRowProps}
                onDelete={handleDelete}
                onToggleVisibility={handleToggleVisibility}
              />
            ))
          )}
        </div>

        {/* Visibility legend */}
        {volunteerDocs.length > 0 && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <EyeIcon color="var(--teal)" /> Visible — shown in volunteer portal
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <EyeOffIcon color="#9ca3af" /> Hidden — saved but not shown to volunteers
            </span>
          </div>
        )}

        <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '6px' }}>
          PDF, Word, Excel, PNG, JPG — up to 50 MB per file
        </p>
      </section>

      {/* ── 3. Internal Repository ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                {t('internal_docs')}
              </h2>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '99px',
                background: 'rgba(245,158,11,0.1)', color: '#92400e',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <LockIcon /> {t('internal')}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {t('internal_docs')}
            </p>
          </div>
          <input ref={adminFileInputRef} type="file" accept={ACCEPT} multiple style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files, uploadAdminDocument, setAdminUploading, setAdminUploadProgress, true)} />
          <UploadButton uploading={adminUploading} progress={adminUploadProgress} onClick={() => !adminUploading && adminFileInputRef.current?.click()} variant="amber" />
        </div>

        <div style={{
          background: 'var(--surface-card)', borderRadius: '12px', overflow: 'hidden',
          border: '1px solid rgba(245,158,11,0.2)',
          boxShadow: '0 0 0 3px rgba(245,158,11,0.04)',
        }}>
          <div style={{
            padding: '8px 16px',
            background: 'rgba(245,158,11,0.06)',
            borderBottom: '1px solid rgba(245,158,11,0.12)',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', color: '#92400e', fontWeight: 600,
          }}>
            <LockIcon />
            These documents are not accessible to volunteers
          </div>
          {internalDocs.length === 0 ? (
            <EmptyState label={t('no_documents_found')} hint={t('internal_docs')} icon="🔒" />
          ) : (
            internalDocs.map((doc, i) => (
              <DocRow key={doc.id} doc={doc} index={i} {...sharedRowProps} onDelete={handleDelete} showAdminBadge />
            ))
          )}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '8px' }}>
          PDF, Word, Excel, PNG, JPG — up to 50 MB per file
        </p>
      </section>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
        {title}
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>{description}</p>
    </div>
  )
}

function EmptyState({ label, hint, icon = '📄' }: { label: string; hint: string; icon?: string }) {
  return (
    <div style={{ padding: '32px', textAlign: 'center', background: 'var(--surface-bg)' }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{hint}</p>
    </div>
  )
}

function UploadButton({ uploading, progress, onClick, variant = 'navy' }: {
  uploading: boolean; progress: string | null; onClick: () => void; variant?: 'navy' | 'amber'
}) {
  const t = useAdminT()
  const bg = uploading ? '#9ca3af' : variant === 'amber' ? '#92400e' : 'var(--navy)'
  return (
    <button onClick={onClick} disabled={uploading} style={{
      display: 'flex', alignItems: 'center', gap: '7px',
      padding: '9px 16px', borderRadius: '9px', background: bg,
      border: 'none', color: 'white', fontSize: '13px', fontWeight: 600,
      cursor: uploading ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
    }}>
      {uploading ? <><SpinnerIcon /> {progress ?? t('sending')}</> : <><UploadIcon /> {t('upload_file')}</>}
    </button>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

function OpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function EyeIcon({ color }: { color?: string } = {}) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon({ color }: { color?: string } = {}) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
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
