'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, UserPlus, Loader2 } from 'lucide-react'
import { createVolunteer } from './actions'
import type { VolunteerCategory, VolunteerStatus } from '@/types/database'

const CATEGORIES: { value: VolunteerCategory; label: string }[] = [
  { value: 'medical_professional', label: 'Medical Professional' },
  { value: 'support_staff',        label: 'Support Staff' },
  { value: 'admin',                label: 'Admin' },
  { value: 'trainee',              label: 'Trainee' },
  { value: 'other',                label: 'Other' },
]

const STATUSES: { value: VolunteerStatus; label: string }[] = [
  { value: 'applicant', label: 'Applicant' },
  { value: 'prospect',  label: 'Prospect' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'inactive',  label: 'Inactive' },
]

interface Props {
  locations: { id: string; name: string }[]
  onClose: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#111827',
  background: 'white',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '5px',
}

export default function AddVolunteerModal({ locations, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [category, setCategory] = useState<VolunteerCategory>('medical_professional')
  const [status, setStatus] = useState<VolunteerStatus>('applicant')
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [sendInvite, setSendInvite] = useState(true)

  // Focus first field on mount
  useEffect(() => { firstFieldRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function toggleLocation(id: string) {
    setLocationIds(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!firstName.trim()) return setError('First name is required.')
    if (!lastName.trim())  return setError('Last name is required.')
    if (!email.trim() || !email.includes('@')) return setError('A valid email is required.')

    startTransition(async () => {
      const result = await createVolunteer({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        category,
        status,
        location_ids: locationIds,
        send_invite: sendInvite,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        router.refresh()
        setTimeout(onClose, 1200)
      }
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 200,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Slide-over panel */}
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: '460px',
        background: 'white',
        zIndex: 201,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        fontFamily: 'system-ui, sans-serif',
        animation: 'slideIn 0.2s ease',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: '#1B2A4A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserPlus style={{ width: '15px', height: '15px', color: 'white' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>
                Add Volunteer
              </h2>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                Creates an account and volunteer profile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f3f4f6', border: 'none', borderRadius: '8px',
              width: '32px', height: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X style={{ width: '15px', height: '15px', color: '#6b7280' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto', padding: '24px' }}>

          {/* Success state */}
          {success && (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: '10px', padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: '10px',
              marginBottom: '20px',
            }}>
              <span style={{ fontSize: '18px' }}>✓</span>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', margin: 0 }}>
                  Volunteer added!
                </p>
                <p style={{ fontSize: '12px', color: '#166534', margin: 0 }}>
                  {sendInvite ? 'An invite email has been sent.' : 'Account created successfully.'}
                </p>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '10px', padding: '12px 14px',
              fontSize: '13px', color: '#dc2626',
              marginBottom: '20px',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>First name *</label>
                <input
                  ref={firstFieldRef}
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Jane"
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Last name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Smith"
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email address *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
                style={inputStyle}
              />
            </div>

            {/* Phone */}
            <div>
              <label style={labelStyle}>Phone <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                style={inputStyle}
              />
            </div>

            {/* Category + Status row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Category *</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as VolunteerCategory)}
                  style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status *</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as VolunteerStatus)}
                  style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                >
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Locations */}
            {locations.length > 0 && (
              <div>
                <label style={labelStyle}>
                  Assign to location(s) <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
                </label>
                <div style={{
                  border: '1px solid #e5e7eb', borderRadius: '8px',
                  overflow: 'hidden',
                }}>
                  {locations.map((loc, i) => (
                    <label
                      key={loc.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px',
                        borderTop: i === 0 ? 'none' : '1px solid #f3f4f6',
                        cursor: 'pointer',
                        background: locationIds.includes(loc.id) ? '#f0f9ff' : 'white',
                        transition: 'background 0.1s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={locationIds.includes(loc.id)}
                        onChange={() => toggleLocation(loc.id)}
                        style={{ width: '15px', height: '15px', accentColor: '#1B2A4A', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', color: '#374151' }}>{loc.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Invite toggle */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: '#f8fafc', borderRadius: '10px',
              padding: '12px 14px', cursor: 'pointer',
              border: `1px solid ${sendInvite ? '#bfdbfe' : '#f0f0f0'}`,
              transition: 'border-color 0.15s',
            }}>
              <input
                type="checkbox"
                checked={sendInvite}
                onChange={e => setSendInvite(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#1B2A4A', marginTop: '1px', cursor: 'pointer' }}
              />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>
                  Send invite email
                </p>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                  Volunteer receives a link to set their own password. Uncheck to create the account silently (you'll need to share credentials manually).
                </p>
              </div>
            </label>

          </div>
        </form>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex', gap: '10px',
          flexShrink: 0,
          background: 'white',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px',
              background: '#f3f4f6', color: '#374151',
              border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit}
            disabled={isPending || success}
            style={{
              flex: 2,
              padding: '10px',
              background: isPending || success ? '#9ca3af' : '#1B2A4A',
              color: 'white',
              border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: 700,
              cursor: isPending || success ? 'default' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            {isPending && <Loader2 style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />}
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            {isPending ? 'Creating…' : success ? '✓ Done' : 'Add Volunteer'}
          </button>
        </div>
      </div>
    </>
  )
}
