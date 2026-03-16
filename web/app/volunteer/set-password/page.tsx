'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetPasswordPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [done, setDone]             = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setDone(true)
      setTimeout(() => router.replace('/volunteer/home'), 1500)
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
        @keyframes spin { to { transform: rotate(360deg) } }
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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '26px', fontWeight: 700,
            color: 'white', margin: 0, textAlign: 'center',
          }}>
            {done ? 'All set!' : 'Create your password'}
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginTop: '8px', textAlign: 'center' }}>
            {done ? 'Taking you to the app…' : 'Choose a secure password for your account.'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          flex: 1,
          background: 'white',
          borderRadius: '28px 28px 0 0',
          padding: '36px 28px',
          paddingBottom: 'max(36px, calc(36px + env(safe-area-inset-bottom)))',
        }}>

          {done ? (
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
              <p style={{ fontSize: '15px', color: '#374151', fontWeight: 500 }}>
                Password saved. Redirecting you now…
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '6px', marginTop: 0 }}>
                Set your password
              </h2>
              <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: 0, marginBottom: '28px' }}>
                This will be the password you use to sign in going forward.
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
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    New password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    style={{
                      width: '100%', padding: '13px 14px', borderRadius: '10px',
                      border: '1.5px solid #e5e7eb', fontSize: '16px', color: '#111827',
                      background: '#f9fafb', fontFamily: "'Figtree', sans-serif",
                    }}
                  />
                </div>

                <div style={{ marginBottom: '28px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Confirm password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    autoComplete="new-password"
                    style={{
                      width: '100%', padding: '13px 14px', borderRadius: '10px',
                      border: `1.5px solid ${confirm && confirm !== password ? '#fca5a5' : '#e5e7eb'}`,
                      fontSize: '16px', color: '#111827',
                      background: '#f9fafb', fontFamily: "'Figtree', sans-serif",
                    }}
                  />
                  {confirm && confirm !== password && (
                    <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '5px' }}>
                      Passwords don&apos;t match
                    </p>
                  )}
                </div>

                {/* Password strength hint */}
                {password.length > 0 && (
                  <div style={{
                    display: 'flex', gap: '4px', marginBottom: '20px',
                  }}>
                    {[8, 10, 12, 14].map(len => (
                      <div key={len} style={{
                        flex: 1, height: '3px', borderRadius: '2px',
                        background: password.length >= len ? '#00897B' : '#e5e7eb',
                        transition: 'background 0.2s',
                      }} />
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending || !password || !confirm || password !== confirm}
                  style={{
                    width: '100%', padding: '15px', borderRadius: '12px',
                    fontSize: '16px', fontWeight: 700, border: 'none',
                    cursor: isPending || !password || !confirm || password !== confirm ? 'not-allowed' : 'pointer',
                    background: isPending || !password || !confirm || password !== confirm ? '#9ca3af' : '#1B2A4A',
                    color: 'white', fontFamily: "'Figtree', sans-serif",
                    transition: 'background 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  {isPending ? (
                    <>
                      <svg style={{ animation: 'spin 0.85s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                      Saving…
                    </>
                  ) : 'Save password & sign in'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  )
}
