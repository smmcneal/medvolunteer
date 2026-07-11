'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Heart } from 'lucide-react'

const NAVY = '#1B2A4A'
const TEAL = '#00897B'

export default function AdminSetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      // The recovery session was established by /auth/callback, so updateUser
      // applies to the signed-in (recovering) admin.
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setError(error.message)
        return
      }

      setDone(true)
      setTimeout(() => {
        router.replace('/dashboard')
        router.refresh()
      }, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 0 8px',
    marginBottom: '24px',
    background: 'transparent',
    border: 'none',
    borderBottom: '1.5px solid #e5e7eb',
    outline: 'none',
    fontSize: '15px',
    color: '#111827',
    fontFamily: 'inherit',
  } as const

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 500,
    color: TEAL,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  } as const

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

        {done ? (
          <>
            <h2 style={{ fontSize: '26px', color: '#111827', fontWeight: 500, marginBottom: '10px' }}>
              Password updated
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>Taking you to your dashboard…</p>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '36px' }}>
              <h2 style={{ fontSize: '26px', color: '#111827', fontWeight: 500, marginBottom: '6px' }}>
                Set a new password
              </h2>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>Must be at least 8 characters.</p>
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
              <label style={labelStyle}>New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={inputStyle}
              />

              <label style={labelStyle}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                style={{ ...inputStyle, marginBottom: '28px' }}
              />

              <button
                type="submit"
                disabled={loading || !password || !confirm}
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
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading || !password || !confirm ? 0.55 : 1,
                }}
              >
                {loading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
