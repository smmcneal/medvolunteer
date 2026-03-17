'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateContactInfo, updateEmergencyContact, uploadCredentialFile, deleteVolunteerUpload, getUploadSignedUrl } from './actions'
import type { Volunteer, Credential, VolunteerUpload, VolunteerStatus, VolunteerCategory } from '@/types/database'
import { useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type VolunteerProfile = Pick<
  Volunteer,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'photo_url' | 'category' | 'status' | 'created_at' |
  'emergency_contact_name' | 'emergency_contact_phone'
>

interface Props {
  volunteer: VolunteerProfile
  credentials: Credential[]
  credentialUploads: VolunteerUpload[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilExpiry(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function categoryLabel(cat: VolunteerCategory): string {
  return {
    medical_professional: 'Medical Professional',
    support_staff: 'Support Staff',
    admin: 'Admin',
    trainee: 'Trainee',
    other: 'Other',
  }[cat] ?? cat
}

function statusColor(status: VolunteerStatus): { bg: string; text: string } {
  return {
    volunteer: { bg: '#dcfce7', text: '#166534' },
    prospect:  { bg: '#dbeafe', text: '#1d4ed8' },
    applicant: { bg: '#fef9c3', text: '#854d0e' },
    inactive:  { bg: '#f3f4f6', text: '#6b7280' },
  }[status] ?? { bg: '#f3f4f6', text: '#6b7280' }
}

function expiryColor(days: number | null): { border: string; badge: { bg: string; text: string } } {
  if (days === null)  return { border: '#e5e7eb', badge: { bg: '#f3f4f6', text: '#6b7280' } }
  if (days < 0)       return { border: '#fca5a5', badge: { bg: '#fee2e2', text: '#991b1b' } }
  if (days <= 7)      return { border: '#fca5a5', badge: { bg: '#fee2e2', text: '#991b1b' } }
  if (days <= 14)     return { border: '#fcd34d', badge: { bg: '#fef3c7', text: '#92400e' } }
  if (days <= 30)     return { border: '#fde68a', badge: { bg: '#fef9c3', text: '#854d0e' } }
  return               { border: '#e5e7eb', badge: { bg: '#f3f4f6', text: '#374151' } }
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileView({ volunteer, credentials, credentialUploads }: Props) {
  const router = useRouter()
  const [isPending, startTransition]   = useTransition()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const credFileInputRef = useRef<HTMLInputElement>(null)
  const [credUploads, setCredUploads]     = useState<VolunteerUpload[]>(credentialUploads)
  const [credUploading, setCredUploading] = useState(false)
  const [credUploadProgress, setCredUploadProgress] = useState<string | null>(null)
  const [credUploadError, setCredUploadError]       = useState<string | null>(null)
  const [credDeletingId, setCredDeletingId]         = useState<string | null>(null)

  // ── Contact edit state ─────────────────────────────────────────────────────
  const [editingContact, setEditingContact] = useState(false)
  const [contactEmail, setContactEmail]     = useState(volunteer.email)
  const [contactPhone, setContactPhone]     = useState(volunteer.phone ?? '')
  const [contactSaving, setContactSaving]   = useState(false)
  const [contactError, setContactError]     = useState<string | null>(null)
  const [contactSaved, setContactSaved]     = useState(false)
  // Local display values (updated optimistically on save)
  const [displayEmail, setDisplayEmail] = useState(volunteer.email)
  const [displayPhone, setDisplayPhone] = useState(volunteer.phone ?? '')

  // ── Emergency contact edit state ────────────────────────────────────────────
  const [editingEmergency, setEditingEmergency]       = useState(false)
  const [emergencyName, setEmergencyName]             = useState(volunteer.emergency_contact_name ?? '')
  const [emergencyPhone, setEmergencyPhone]           = useState(volunteer.emergency_contact_phone ?? '')
  const [emergencySaving, setEmergencySaving]         = useState(false)
  const [emergencyError, setEmergencyError]           = useState<string | null>(null)
  const [emergencySaved, setEmergencySaved]           = useState(false)
  const [displayEmergencyName, setDisplayEmergencyName]   = useState(volunteer.emergency_contact_name ?? '')
  const [displayEmergencyPhone, setDisplayEmergencyPhone] = useState(volunteer.emergency_contact_phone ?? '')

  function startEditEmergency() {
    setEmergencyName(displayEmergencyName)
    setEmergencyPhone(displayEmergencyPhone)
    setEmergencyError(null)
    setEmergencySaved(false)
    setEditingEmergency(true)
  }

  function cancelEditEmergency() {
    setEditingEmergency(false)
    setEmergencyError(null)
  }

  async function saveEmergencyContact() {
    setEmergencySaving(true)
    setEmergencyError(null)
    const result = await updateEmergencyContact(volunteer.id, emergencyName, emergencyPhone)
    setEmergencySaving(false)
    if (result.error) { setEmergencyError(result.error); return }
    setDisplayEmergencyName(emergencyName.trim())
    setDisplayEmergencyPhone(emergencyPhone.trim())
    setEditingEmergency(false)
    setEmergencySaved(true)
    setTimeout(() => setEmergencySaved(false), 3000)
  }

  function startEditContact() {
    setContactEmail(displayEmail)
    setContactPhone(displayPhone)
    setContactError(null)
    setContactSaved(false)
    setEditingContact(true)
  }

  function cancelEditContact() {
    setEditingContact(false)
    setContactError(null)
  }

  async function saveContactInfo() {
    setContactSaving(true)
    setContactError(null)
    const result = await updateContactInfo(volunteer.id, contactEmail, contactPhone)
    setContactSaving(false)
    if (result.error) {
      setContactError(result.error)
      return
    }
    setDisplayEmail(contactEmail.trim().toLowerCase())
    setDisplayPhone(contactPhone.trim())
    setEditingContact(false)
    setContactSaved(true)
    setTimeout(() => setContactSaved(false), 3000)
  }

  function handleSignOut() {
    startTransition(async () => {
      setSignOutError(null)
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        setSignOutError(error.message)
        return
      }
      router.replace('/volunteer/login')
    })
  }

  const statusStyle = statusColor(volunteer.status)
  const memberSince = new Date(volunteer.created_at).getFullYear()

  const activeCredentials  = credentials.filter(c => { const d = daysUntilExpiry(c.expiration_date); return d === null || d >= 0 })
  const expiredCredentials = credentials.filter(c => { const d = daysUntilExpiry(c.expiration_date); return d !== null && d < 0 })

  const CRED_ACCEPT = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain',
  ].join(',')

  async function handleCredFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setCredUploadError(null)
    setCredUploading(true)
    for (const file of Array.from(files)) {
      setCredUploadProgress(`Uploading ${file.name}…`)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('volunteerId', volunteer.id)
      const result = await uploadCredentialFile(fd)
      if (result.error) {
        setCredUploadError(result.error)
        setCredUploading(false)
        setCredUploadProgress(null)
        return
      }
      setCredUploads(prev => [{
        id: crypto.randomUUID(),
        volunteer_id: volunteer.id,
        name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        storage_path: '',
        uploaded_by: null,
        uploaded_at: new Date().toISOString(),
        category: 'credential',
      }, ...prev])
    }
    setCredUploading(false)
    setCredUploadProgress(null)
  }

  async function handleCredDelete(upload: VolunteerUpload) {
    setCredDeletingId(upload.id)
    const result = await deleteVolunteerUpload(upload.id, upload.storage_path)
    setCredDeletingId(null)
    if (result.error) { setCredUploadError(result.error); return }
    setCredUploads(prev => prev.filter(u => u.id !== upload.id))
  }

  async function handleCredView(upload: VolunteerUpload) {
    const result = await getUploadSignedUrl(upload.storage_path)
    if (result.error || !result.url) { setCredUploadError(result.error ?? 'Could not open file'); return }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  function credFileColor(mime: string): string {
    if (mime === 'application/pdf')                          return '#ef4444'
    if (mime.includes('word') || mime.includes('document')) return '#2563eb'
    if (mime.includes('excel') || mime.includes('sheet'))   return '#16a34a'
    if (mime.startsWith('image/'))                          return '#8b5cf6'
    return '#9ca3af'
  }

  function credExtBadge(name: string, mime: string): string {
    const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : ''
    if (ext)                               return ext.slice(0, 4)
    if (mime === 'application/pdf')        return 'PDF'
    if (mime.startsWith('image/'))         return mime.split('/')[1].toUpperCase().slice(0, 4)
    return 'FILE'
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024)           return `${bytes} B`
    if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div style={{ paddingBottom: '24px', fontFamily: "'Figtree', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1B2A4A 0%, #243660 100%)',
        padding: 'calc(env(safe-area-inset-top) + 48px) 20px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: '#00897B',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '26px', fontWeight: 800, color: 'white', letterSpacing: '1px',
          flexShrink: 0, border: '3px solid rgba(255,255,255,0.2)',
        }}>
          {initials(volunteer.first_name, volunteer.last_name)}
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'white', margin: '0 0 4px', letterSpacing: '-0.3px' }}>
            {volunteer.first_name} {volunteer.last_name}
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 8px' }}>
            {categoryLabel(volunteer.category)} · Member since {memberSince}
          </p>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: '999px',
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
            background: statusStyle.bg, color: statusStyle.text,
          }}>
            {volunteer.status}
          </span>
        </div>
      </div>

      <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Contact Info ── */}
        <div>
          {/* Section header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 4px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
              Contact Information
            </h2>
            {!editingContact && (
              <button
                onClick={startEditContact}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#00897B', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <PencilIcon /> Edit
              </button>
            )}
            {editingContact && (
              <button
                onClick={cancelEditContact}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#9ca3af', fontFamily: 'inherit', padding: 0 }}
              >
                Cancel
              </button>
            )}
          </div>

          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            {editingContact ? (
              /* ── Edit mode ── */
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {contactError && (
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '13px', color: '#dc2626' }}>
                    {contactError}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '5px' }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    autoComplete="email"
                    style={{
                      width: '100%', padding: '11px 13px', borderRadius: '10px',
                      border: '1.5px solid #e5e7eb', fontSize: '15px', color: '#111827',
                      background: '#fafafa', outline: 'none', boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '5px' }}>
                    Phone number
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder="—"
                    style={{
                      width: '100%', padding: '11px 13px', borderRadius: '10px',
                      border: '1.5px solid #e5e7eb', fontSize: '15px', color: '#111827',
                      background: '#fafafa', outline: 'none', boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <button
                  onClick={saveContactInfo}
                  disabled={contactSaving}
                  style={{
                    width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
                    background: contactSaving ? '#9ca3af' : '#1B2A4A',
                    color: 'white', fontSize: '15px', fontWeight: 700,
                    cursor: contactSaving ? 'default' : 'pointer',
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'background 0.15s',
                  }}
                >
                  {contactSaving ? <><MiniSpinner /> Saving…</> : 'Save changes'}
                </button>
              </div>
            ) : (
              /* ── Read mode ── */
              <>
                <InfoRow icon={EmailIcon} label="Email" value={displayEmail || '—'} />
                <InfoRow icon={PhoneIcon} label="Phone" value={displayPhone || '—'} />
                {contactSaved && (
                  <div style={{ padding: '10px 16px', fontSize: '13px', color: '#16a34a', background: '#f0fdf4', borderTop: '1px solid #dcfce7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckIcon /> Contact info updated
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Emergency Contact ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 4px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
              Emergency Contact
            </h2>
            {!editingEmergency && (
              <button
                onClick={startEditEmergency}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#00897B', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <PencilIcon /> Edit
              </button>
            )}
            {editingEmergency && (
              <button
                onClick={cancelEditEmergency}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#9ca3af', fontFamily: 'inherit', padding: 0 }}
              >
                Cancel
              </button>
            )}
          </div>

          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            {editingEmergency ? (
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {emergencyError && (
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '13px', color: '#dc2626' }}>
                    {emergencyError}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '5px' }}>
                    Contact name
                  </label>
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={e => setEmergencyName(e.target.value)}
                    placeholder="Full name"
                    autoComplete="off"
                    style={{ width: '100%', padding: '11px 13px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '15px', color: '#111827', background: '#fafafa', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '5px' }}>
                    Phone number
                  </label>
                  <input
                    type="tel"
                    value={emergencyPhone}
                    onChange={e => setEmergencyPhone(e.target.value)}
                    placeholder="—"
                    autoComplete="off"
                    style={{ width: '100%', padding: '11px 13px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '15px', color: '#111827', background: '#fafafa', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
                <button
                  onClick={saveEmergencyContact}
                  disabled={emergencySaving}
                  style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: emergencySaving ? '#9ca3af' : '#1B2A4A', color: 'white', fontSize: '15px', fontWeight: 700, cursor: emergencySaving ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}
                >
                  {emergencySaving ? <><MiniSpinner /> Saving…</> : 'Save changes'}
                </button>
              </div>
            ) : (
              <>
                <InfoRow icon={PersonIcon} label="Name" value={displayEmergencyName || '—'} />
                <InfoRow icon={PhoneIcon} label="Phone" value={displayEmergencyPhone || '—'} />
                {emergencySaved && (
                  <div style={{ padding: '10px 16px', fontSize: '13px', color: '#16a34a', background: '#f0fdf4', borderTop: '1px solid #dcfce7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckIcon /> Emergency contact updated
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Credentials ── */}
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px 4px' }}>
            Credentials{credentials.length > 0 ? ` (${credentials.length})` : ''}
          </h2>
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            {credentials.length === 0 ? (
              <EmptyState message="No credentials on file" />
            ) : (
              <>
                {activeCredentials.map(cred => <CredentialCard key={cred.id} cred={cred} />)}
                {expiredCredentials.length > 0 && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 16px 2px' }}>
                      Expired
                    </div>
                    {expiredCredentials.map(cred => <CredentialCard key={cred.id} cred={cred} />)}
                  </>
                )}
              </>
            )}

            {/* ── Credential file uploads ── */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '10px' }}>
                Supporting Documents
              </p>

              {/* Error */}
              {credUploadError && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', marginBottom: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626' }}>
                  <span>{credUploadError}</span>
                  <button onClick={() => setCredUploadError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}>✕</button>
                </div>
              )}

              {/* Uploaded credential files */}
              {credUploads.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #f0f0f0', marginBottom: '10px' }}>
                  {credUploads.map((u, i) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px', background: 'white', borderTop: i > 0 ? '1px solid #f9fafb' : 'none', opacity: credDeletingId === u.id ? 0.45 : 1 }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, background: credFileColor(u.mime_type) + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: credFileColor(u.mime_type) }}>
                        {credExtBadge(u.name, u.mime_type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
                        <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>{formatBytes(u.size_bytes)}</p>
                      </div>
                      <button onClick={() => handleCredView(u)} title="Open" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', borderRadius: '6px', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </button>
                      <button onClick={() => handleCredDelete(u)} disabled={credDeletingId === u.id} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', borderRadius: '6px', color: '#d1d5db', display: 'flex', alignItems: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <input ref={credFileInputRef} type="file" accept={CRED_ACCEPT} multiple style={{ display: 'none' }} onChange={e => handleCredFiles(e.target.files)} />
              <button
                onClick={() => !credUploading && credFileInputRef.current?.click()}
                disabled={credUploading}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: '2px dashed #e5e7eb', background: credUploading ? '#f9fafb' : 'white',
                  color: credUploading ? '#9ca3af' : '#374151',
                  fontSize: '13px', fontWeight: 600,
                  cursor: credUploading ? 'wait' : 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {credUploading ? (
                  <><MiniSpinner /> {credUploadProgress ?? 'Uploading…'}</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload Credential Document
                  </>
                )}
              </button>
              <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '6px' }}>PDF, Word, Excel, PNG, JPG — up to 50 MB</p>
            </div>
          </div>
        </div>

        {/* ── Sign Out ── */}
        <div style={{ paddingTop: '8px' }}>
          {signOutError && (
            <p style={{
              fontSize: '13px', color: '#991b1b',
              background: '#fee2e2', border: '1px solid #fca5a5',
              borderRadius: '8px', padding: '10px 12px', marginBottom: '12px',
            }}>
              {signOutError}
            </p>
          )}
          <button
            onClick={handleSignOut}
            disabled={isPending}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              border: '1.5px solid #e5e7eb', background: 'white',
              color: isPending ? '#9ca3af' : '#374151',
              fontSize: '15px', fontWeight: 600,
              cursor: isPending ? 'default' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.15s',
            }}
          >
            <SignOutIcon />
            {isPending ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children, noPadding }: { title: string; children: React.ReactNode; noPadding?: boolean }) {
  return (
    <div>
      <h2 style={{
        fontSize: '13px', fontWeight: 700, color: '#6b7280',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        margin: '0 0 8px 4px',
      }}>
        {title}
      </h2>
      <div style={{
        background: 'white', borderRadius: '14px',
        border: '1px solid #f0f0f0', overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.FC; label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '14px 16px', borderBottom: '1px solid #f9fafb',
    }}>
      <div style={{ color: '#9ca3af', flexShrink: 0 }}><Icon /></div>
      <div>
        <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, marginBottom: '1px' }}>{label}</div>
        <div style={{ fontSize: '14px', color: '#111827', fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  )
}

function CredentialCard({ cred }: { cred: Credential }) {
  const days   = daysUntilExpiry(cred.expiration_date)
  const colors = expiryColor(days)

  let expiryLabel = '—'
  if (days !== null) {
    if (days < 0)      expiryLabel = `Expired ${Math.abs(days)}d ago`
    else if (days === 0) expiryLabel = 'Expires today'
    else if (days <= 30) expiryLabel = `Expires in ${days}d`
    else expiryLabel = `Exp: ${formatDate(cred.expiration_date)}`
  }

  return (
    <div style={{
      padding: '14px 16px', borderBottom: '1px solid #f9fafb',
      borderLeft: `3px solid ${colors.border}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>{cred.type}</div>
          {cred.license_number && <div style={{ fontSize: '12px', color: '#6b7280' }}>#{cred.license_number}</div>}
          {cred.issuing_body    && <div style={{ fontSize: '12px', color: '#9ca3af' }}>{cred.issuing_body}</div>}
        </div>
        <span style={{
          padding: '3px 8px', borderRadius: '6px',
          fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
          background: colors.badge.bg, color: colors.badge.text, flexShrink: 0,
        }}>
          {expiryLabel}
        </span>
      </div>
      {cred.verified_at && (
        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <VerifiedIcon />
          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
            Verified {formatDate(cred.verified_at)}
          </span>
        </div>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
      {message}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1 19.79 19.79 0 0 1 1.61 4.5 2 2 0 0 1 3.6 2.32h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

function VerifiedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#16a34a">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function MiniSpinner() {
  return (
    <svg style={{ animation: 'spin 0.85s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none">
      <style suppressHydrationWarning>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
