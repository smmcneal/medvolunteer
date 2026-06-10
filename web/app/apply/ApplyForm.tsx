'use client'

import { useState } from 'react'
import { submitApplication } from './actions'

const CATEGORIES = [
  { value: 'medical_professional', label: 'Medical Professional (MD, NP, PA, RN, etc.)' },
  { value: 'support_staff',        label: 'Support Staff (Admin, Front Desk, etc.)' },
  { value: 'trainee',              label: 'Student / Trainee' },
  { value: 'other',                label: 'Other' },
]

const NAVY = '#1B2A4A'
const TEAL = '#00897B'

export default function ApplyForm() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', category: '', message: '', website: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [done, setDone]       = useState(false)

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category) { setError('Please select a volunteer type.'); return }
    setLoading(true)
    setError(null)
    const result = await submitApplication(form)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    setDone(true)
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '3rem 2rem', textAlign: 'center', maxWidth: 440, boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${TEAL}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', color: NAVY, marginBottom: '.75rem' }}>Application received!</h2>
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>Thank you for your interest in volunteering. Our team will review your application and be in touch soon.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={{ background: NAVY, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div>
          <div style={{ color: '#fff', fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700 }}>MedVolunteer</div>
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: '.75rem' }}>Volunteer Application</div>
        </div>
      </header>

      {/* Form */}
      <main style={{ maxWidth: 600, margin: '2.5rem auto', padding: '0 1.5rem 3rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', color: NAVY, marginBottom: '.5rem' }}>Apply to volunteer</h1>
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>Fill out the form below and our team will review your application and follow up with next steps.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '.875rem 1rem', marginBottom: '1.5rem', color: '#dc2626', fontSize: '.875rem' }}>
              {error}
            </div>
          )}

          {/* Honeypot — invisible to humans, bots that fill it are dropped server-side */}
          <input
            type="text"
            name="website"
            value={form.website}
            onChange={set('website')}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          />

          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <Field label="First name" required>
              <input required value={form.first_name} onChange={set('first_name')} placeholder="Jane" style={inputStyle} />
            </Field>
            <Field label="Last name" required>
              <input required value={form.last_name} onChange={set('last_name')} placeholder="Smith" style={inputStyle} />
            </Field>
          </div>

          <Field label="Email address" required style={{ marginBottom: '1rem' }}>
            <input required type="email" value={form.email} onChange={set('email')} placeholder="jane@example.com" style={inputStyle} />
          </Field>

          <Field label="Phone number" style={{ marginBottom: '1rem' }}>
            <input type="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" style={inputStyle} />
          </Field>

          <Field label="Volunteer type" required style={{ marginBottom: '1rem' }}>
            <select required value={form.category} onChange={set('category')} style={{ ...inputStyle, color: form.category ? '#1e293b' : '#94a3b8' }}>
              <option value="" disabled>Select one…</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Tell us about yourself" style={{ marginBottom: '1.75rem' }}>
            <textarea
              value={form.message}
              onChange={set('message')}
              placeholder="Share your background, skills, and why you'd like to volunteer…"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '.875rem', borderRadius: 8, border: 'none',
              background: loading ? '#94a3b8' : TEAL, color: '#fff',
              fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Figtree', sans-serif", transition: 'background .15s',
            }}
          >
            {loading ? 'Submitting…' : 'Submit application'}
          </button>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '.8125rem', color: '#94a3b8' }}>
            Already a volunteer?{' '}
            <a href="/volunteer/login" style={{ color: TEAL, textDecoration: 'none', fontWeight: 500 }}>Sign in →</a>
          </p>
        </form>
      </main>
    </div>
  )
}

function Field({ label, required, children, style }: {
  label: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: '.8125rem', fontWeight: 600, color: '#374151', marginBottom: '.375rem' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '.625rem .875rem', border: '1px solid #e2e8f0',
  borderRadius: 7, fontSize: '.9375rem', fontFamily: "'Figtree', sans-serif",
  outline: 'none', background: '#fff', color: '#1e293b',
}
