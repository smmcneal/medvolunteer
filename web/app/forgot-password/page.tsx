'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Heart } from 'lucide-react'

const NAVY = '#1B2A4A'
const TEAL = '#00897B'

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          // /auth/callback exchanges the recovery code, then forwards here.
          redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
        }
      )

      if (error) {
        setError(error.message)
        return
      }

      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        background: 'white',
        fontFamily: "'Figtree', system-ui, sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: '360px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '44px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: NAVY,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Heart style={{ width: '18px', height: '18px', color: 'white', fill: 'white' }} />
          </div>
          <span style={{ fontSize: '17px', color: NAVY, fontWeight: 500 }}>MedVolunteer</span>
        </div>

        {sent ? (
          <>
            <h2 style={{ fontSize: '26px', color: '#111827', fontWeight: 500, marginBottom: '10px' }}>
              Check your email
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.7 }}>
              If an account exists for <strong style={{ color: '#111827' }}>{email}</strong>, we&apos;ve
              sent a link to reset your password. The link expires in one hour.
            </p>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '36px' }}>
              <h2 style={{ fontSize: '26px', color: '#111827', fontWeight: 500, marginBottom: '6px' }}>
                Reset your password
              </h2>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                We&apos;ll email you a link to set a new one.
              </p>
            </div>

            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: '13px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: TEAL,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  width: '100%',
                  padding: '10px 0 8px',
                  marginBottom: '28px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1.5px solid #e5e7eb',
                  outline: 'none',
                  fontSize: '15px',
                  color: '#111827',
                  fontFamily: 'inherit',
                }}
              />

              <button
                type="submit"
                disabled={loading || !email}
                style={{
                  width: '100%',
                  padding: '13px 24px',
                  background: NAVY,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: loading || !email ? 'not-allowed' : 'pointer',
                  opacity: loading || !email ? 0.55 : 1,
                }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '28px' }}>
          <Link href="/login" style={{ fontSize: '13px', color: '#9ca3af', textDecoration: 'none' }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
