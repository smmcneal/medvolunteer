'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [sent, setSent]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          // After clicking the reset link the volunteer lands on /auth/callback
          // which exchanges the code and redirects to /volunteer/set-password
          redirectTo: `${window.location.origin}/auth/callback?next=/volunteer/set-password`,
        }
      )

      if (resetError) {
        setError(resetError.message)
      } else {
        setSent(true)
      }
    })
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        body { background: #1B2A4A; }
        input:focus {
          outline: none;
          border-color: #00897B !important;
          box-shadow: 0 0 0 3px rgba(0,137,123,0.15);
        }
      `}</style>

      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#1B2A4A',
        fontFamily: "'Figtree', sans-serif",
      }}>

        {/* Hero */}
        <div style={{
          padding: '56px 32px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{
            width: '64px', height: '64px',
            borderRadius: '16px',
            background: '#00897B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
            boxShadow: '0 8px 24px rgba(0,137,123,0.4)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '26px', fontWeight: 700,
            color: 'white', margin: 0, textAlign: 'center',
          }}>
            Reset password
          </h1>
        </div>

        {/* Card */}
        <div style={{
          flex: 1,
          background: 'white',
          borderRadius: '28px 28px 0 0',
          padding: '36px 28px',
          paddingBottom: 'max(36px, calc(36px + env(safe-area-inset-bottom)))',
        }}>

          {sent ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center', paddingTop: '16px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: '#f0fdf4', border: '2px solid #bbf7d0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '10px' }}>
                Check your email
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.65, marginBottom: '28px' }}>
                We sent a password reset link to <strong style={{ color: '#111827' }}>{email}</strong>.
                Click the link in the email to set a new password.
              </p>
              <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                Didn&apos;t receive it? Check your spam folder or{' '}
                <button
                  onClick={() => setSent(false)}
                  style={{ background: 'none', border: 'none', color: '#00897B', fontWeight: 600, cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', padding: 0 }}
                >
                  try again
                </button>.
              </p>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '6px', marginTop: 0 }}>
                Forgot your password?
              </h2>
              <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: 0, marginBottom: '28px' }}>
                Enter your email and we&apos;ll send you a link to reset it.
              </p>

              {error && (
                <div style={{
                  padding: '12px 14px',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: '10px', fontSize: '14px', color: '#dc2626',
                  marginBottom: '20px',
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    style={{
                      width: '100%', padding: '13px 14px', borderRadius: '10px',
                      border: '1.5px solid #e5e7eb', fontSize: '16px', color: '#111827',
                      background: '#f9fafb', fontFamily: "'Figtree', sans-serif",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending || !email}
                  style={{
                    width: '100%', padding: '15px', borderRadius: '12px',
                    fontSize: '16px', fontWeight: 700, border: 'none',
                    cursor: isPending || !email ? 'not-allowed' : 'pointer',
                    background: isPending || !email ? '#9ca3af' : '#1B2A4A',
                    color: 'white', fontFamily: "'Figtree', sans-serif",
                    transition: 'background 0.15s',
                  }}
                >
                  {isPending ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <Link href="/volunteer/login" style={{
              fontSize: '13px', color: '#9ca3af', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: '4px',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
              </svg>
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
