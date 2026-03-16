'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import VolunteerDocumentsSection from './VolunteerDocumentsSection'
import type { Volunteer, Credential, Document, VolunteerUpload, VolunteerStatus, VolunteerCategory } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type VolunteerProfile = Pick<
  Volunteer,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'photo_url' | 'category' | 'status' | 'created_at'
>

interface Props {
  volunteer: VolunteerProfile
  credentials: Credential[]
  documents: Document[]
  uploads: VolunteerUpload[]
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

export default function ProfileView({ volunteer, credentials, documents, uploads }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [signOutError, setSignOutError] = useState<string | null>(null)

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

  const docCount = uploads.length + documents.length

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
        <Section title="Contact Information">
          <InfoRow icon={EmailIcon} label="Email" value={volunteer.email} />
          <InfoRow icon={PhoneIcon} label="Phone" value={volunteer.phone ?? '—'} />
        </Section>

        {/* ── Credentials ── */}
        <Section title={`Credentials${credentials.length > 0 ? ` (${credentials.length})` : ''}`}>
          {credentials.length === 0 ? (
            <EmptyState message="No credentials on file" />
          ) : (
            <>
              {activeCredentials.map(cred => <CredentialCard key={cred.id} cred={cred} />)}
              {expiredCredentials.length > 0 && (
                <>
                  <div style={{
                    fontSize: '11px', fontWeight: 700, color: '#9ca3af',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '4px 16px 2px',
                  }}>
                    Expired
                  </div>
                  {expiredCredentials.map(cred => <CredentialCard key={cred.id} cred={cred} />)}
                </>
              )}
            </>
          )}
        </Section>

        {/* ── Documents ── */}
        <Section title={`Documents${docCount > 0 ? ` (${docCount})` : ''}`} noPadding>
          <div style={{ padding: '16px' }}>
            <VolunteerDocumentsSection
              volunteerId={volunteer.id}
              uploads={uploads}
              signedDocuments={documents}
            />
          </div>
        </Section>

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
