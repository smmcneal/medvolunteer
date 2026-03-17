'use client'

import { useState } from 'react'
import { getOrgDocumentSignedUrl } from '@/app/dashboard/documents/actions'
import type { OrgDocument } from '@/types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  docs: OrgDocument[]
}

export default function VolunteerDocumentsView({ docs }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const presetDocs   = docs.filter(d => d.is_preset).sort((a, b) => a.sort_order - b.sort_order)
  const uploadedDocs = docs.filter(d => !d.is_preset)

  async function handleOpen(doc: OrgDocument) {
    if (doc.public_path) {
      window.open(doc.public_path, '_blank', 'noopener,noreferrer')
      return
    }
    if (!doc.storage_path) return
    setLoadingId(doc.id)
    const result = await getOrgDocumentSignedUrl(doc.storage_path)
    setLoadingId(null)
    if (result.error || !result.url) { setError(result.error ?? 'Could not open document'); return }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  const allDocs = [...presetDocs, ...uploadedDocs]

  return (
    <div style={{ paddingBottom: '32px', fontFamily: "'Figtree', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1B2A4A 0%, #243660 100%)',
        padding: 'calc(env(safe-area-inset-top) + 48px) 20px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.3px' }}>
              Documents
            </h1>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: '2px 0 0' }}>
              {allDocs.length} document{allDocs.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', marginBottom: '14px',
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
            fontSize: '13px', color: '#dc2626',
          }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}>✕</button>
          </div>
        )}

        {allDocs.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '40px 20px', textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>No documents yet</p>
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>Check back soon</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Preset forms section */}
            {presetDocs.length > 0 && (
              <div>
                <p style={{
                  fontSize: '11px', fontWeight: 700, color: '#9ca3af',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '8px', paddingLeft: '4px',
                }}>
                  Forms &amp; Disclosures
                </p>
                <div style={{
                  background: 'white', borderRadius: '14px',
                  border: '1px solid #f0f0f0', overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  {presetDocs.map((doc, i) => (
                    <DocRow
                      key={doc.id}
                      doc={doc}
                      isFirst={i === 0}
                      isLoading={loadingId === doc.id}
                      onOpen={() => handleOpen(doc)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Uploaded docs */}
            {uploadedDocs.length > 0 && (
              <div>
                <p style={{
                  fontSize: '11px', fontWeight: 700, color: '#9ca3af',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '8px', paddingLeft: '4px', marginTop: '6px',
                }}>
                  Additional Documents
                </p>
                <div style={{
                  background: 'white', borderRadius: '14px',
                  border: '1px solid #f0f0f0', overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  {uploadedDocs.map((doc, i) => (
                    <DocRow
                      key={doc.id}
                      doc={doc}
                      isFirst={i === 0}
                      isLoading={loadingId === doc.id}
                      onOpen={() => handleOpen(doc)}
                    />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

// ─── DocRow ───────────────────────────────────────────────────────────────────

function DocRow({
  doc,
  isFirst,
  isLoading,
  onOpen,
}: {
  doc: OrgDocument
  isFirst: boolean
  isLoading: boolean
  onOpen: () => void
}) {
  const color = fileColor(doc.mime_type)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '14px 16px',
      borderTop: isFirst ? 'none' : '1px solid #f9fafb',
    }}>
      {/* File type icon */}
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
        background: color + '15',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', fontWeight: 800, color: color,
        letterSpacing: '0.02em',
      }}>
        {extBadge(doc.name, doc.mime_type)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {doc.name}
        </p>
        {doc.description && (
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>
            {doc.description}
          </p>
        )}
      </div>

      <button
        onClick={onOpen}
        disabled={isLoading}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '8px 14px', borderRadius: '9px',
          background: isLoading ? '#9ca3af' : '#1B2A4A',
          border: 'none', color: 'white',
          fontSize: '13px', fontWeight: 600,
          cursor: isLoading ? 'wait' : 'pointer',
          fontFamily: 'inherit', flexShrink: 0,
        }}
      >
        {isLoading ? (
          <SpinnerIcon />
        ) : (
          <OpenIcon />
        )}
        {isLoading ? 'Opening…' : 'Open'}
      </button>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function OpenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg style={{ animation: 'spin 0.85s linear infinite' }} width="13" height="13" viewBox="0 0 24 24" fill="none">
      <style suppressHydrationWarning>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
