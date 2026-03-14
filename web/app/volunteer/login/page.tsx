'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function VolunteerLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(authError.message)
      } else {
        router.replace('/volunteer/home')
      }
    })
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        body { background: #1B2A4A; }
        input { font-family: 'Figtree', sans-serif; }
        input:focus { outline: none; border-color: #00897B !important; box-shadow: 0 0 0 3px rgba(0,137,123,0.15); }
      `}</style>

      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#1B2A4A',
        fontFamily: "'Figtree', sans-serif",
      }}>

        {/* Hero section */}
        <div style={{
          padding: '56px 32px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          {/* Logo mark */}
          <div style={{
            width: '64px', height: '64px',
            borderRadius: '16px',
            background: '#00897B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
            boxShadow: '0 8px 24px rgba(0,137,123,0.4)',
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="14" y="4" width="8" height="28" rx="3" fill="white"/>
              <rect x="4" y="14" width="28" height="8" rx="3" fill="white"/>
            </svg>
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '28px',
            fontWeight: 700,
            color: 'white',
            margin: 0,
            textAlign: 'center',
            letterSpacing: '-0.5px',
          }}>MedVolunteer</h1>

          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginTop: '8px', textAlign: 'center' }}>
            Your volunteer portal
          </p>
        </div>

        {/* Form card — slides up from bottom */}
        <div style={{
          flex: 1,
          background: 'white',
          borderRadius: '28px 28px 0 0',
          padding: '36px 28px calc(36px + env(safe-area-inset-bottom))',
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '6px', marginTop: 0 }}>
            Sign in
          </h2>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: 0, marginBottom: '28px' }}>
            Use the email address your coordinator registered you with.
          </p>

          {error && (
            <div style={{
              padding: '12px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              fontSize: '14px',
              color: '#dc2626',
              marginBottom: '20px',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={isPending || !email || !password}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 700,
                border: 'none',
                cursor: isPending || !email || !password ? 'not-allowed' : 'pointer',
                background: isPending || !email || !password ? '#9ca3af' : '#1B2A4A',
                color: 'white',
                letterSpacing: '0.02em',
                transition: 'background 0.15s',
              }}
            >
              {isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', marginTop: '24px' }}>
            Need access? Contact your coordinator.
          </p>
        </div>
      </div>
    </>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 14px',
  borderRadius: '10px',
  border: '1.5px solid #e5e7eb',
  fontSize: '16px', // 16px prevents iOS zoom on focus
  color: '#111827',
  background: '#f9fafb',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}
