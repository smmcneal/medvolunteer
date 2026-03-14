'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Heart, ArrowRight } from 'lucide-react'

const NAVY = '#1B2A4A'
const TEAL = '#00897B'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Figtree:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .mv-root { font-family: 'Figtree', system-ui, sans-serif; }
        .mv-serif { font-family: 'Playfair Display', Georgia, serif; }

        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          14%       { transform: scale(1.18); }
          28%       { transform: scale(1); }
          42%       { transform: scale(1.1); }
          56%       { transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes drawEkg {
          from { stroke-dashoffset: 1200; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(2.2); opacity: 0;   }
        }

        .mv-heart { animation: heartbeat 2.5s ease-in-out infinite; }

        .mv-fade { animation: fadeUp 0.55s ease both; }
        .mv-d1  { animation-delay: 0.08s; }
        .mv-d2  { animation-delay: 0.18s; }
        .mv-d3  { animation-delay: 0.28s; }
        .mv-d4  { animation-delay: 0.38s; }

        .mv-ekg {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: drawEkg 3.5s ease forwards;
          animation-delay: 0.6s;
        }

        .mv-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.06);
          animation: pulseRing 4s cubic-bezier(0.215,0.61,0.355,1) infinite;
        }
        .mv-ring-2 { animation-delay: 1.3s; border-color: rgba(0,137,123,0.15); }

        .mv-input {
          background: transparent;
          border: none;
          border-bottom: 1.5px solid #e5e7eb;
          outline: none;
          width: 100%;
          padding: 10px 0 8px;
          font-size: 15px;
          font-family: 'Figtree', system-ui, sans-serif;
          color: #111827;
          transition: border-color 0.2s;
        }
        .mv-input:focus { border-bottom-color: ${TEAL}; }

        .mv-label {
          position: absolute;
          top: 10px;
          left: 0;
          font-size: 14px;
          color: #9ca3af;
          pointer-events: none;
          font-family: 'Figtree', system-ui, sans-serif;
          font-weight: 400;
          transition: all 0.2s ease;
        }
        .mv-label.up {
          top: -16px;
          font-size: 11px;
          color: ${TEAL};
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .mv-underline {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 1.5px;
          background: ${TEAL};
          transition: width 0.3s ease;
        }

        .mv-btn {
          width: 100%;
          padding: 13px 24px;
          background: ${NAVY};
          color: white;
          border: none;
          border-radius: 8px;
          font-family: 'Figtree', system-ui, sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
          letter-spacing: 0.02em;
          position: relative;
          overflow: hidden;
        }
        .mv-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: ${TEAL};
          opacity: 0;
          transition: opacity 0.3s;
        }
        .mv-btn:hover:not(:disabled)::after  { opacity: 0.18; }
        .mv-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(27,42,74,0.28);
        }
        .mv-btn:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
        .mv-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .mv-btn span { position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; }

        .mv-spinner {
          width: 16px; height: 16px;
          animation: spin 0.85s linear infinite;
        }

        @media (max-width: 820px) {
          .mv-left  { display: none !important; }
          .mv-right { padding: 36px 28px !important; }
        }
      `}</style>

      <div className="mv-root" style={{ display: 'flex', minHeight: '100vh' }}>

        {/* ── LEFT PANEL ────────────────────────────────── */}
        <div className="mv-left" style={{
          width: '44%',
          background: NAVY,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative blobs */}
          <div style={{
            position: 'absolute', top: '-80px', left: '-80px',
            width: '320px', height: '320px', borderRadius: '50%',
            background: 'rgba(0,137,123,0.07)',
          }} />
          <div style={{
            position: 'absolute', top: '38%', right: '-90px',
            width: '380px', height: '380px',
          }}>
            <div className="mv-ring" />
            <div className="mv-ring mv-ring-2" />
          </div>
          <div style={{
            position: 'absolute', bottom: '140px', left: '-30px',
            width: '160px', height: '160px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
          }} />

          {/* Logo */}
          <div className="mv-fade mv-d1" style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: TEAL,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Heart className="mv-heart" style={{ width: '22px', height: '22px', color: 'white', fill: 'white' }} />
            </div>
            <span className="mv-serif" style={{ fontSize: '20px', color: 'white', fontWeight: 500 }}>
              MedVolunteer
            </span>
          </div>

          {/* Hero text */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '56px 0', position: 'relative' }}>
            <div className="mv-fade mv-d1" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'rgba(0,137,123,0.14)',
              border: '1px solid rgba(0,137,123,0.28)',
              borderRadius: '20px', padding: '4px 12px', marginBottom: '24px',
              width: 'fit-content',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: TEAL }} />
              <span style={{ fontSize: '11px', color: 'rgba(0,200,180,0.9)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Coordinator Portal
              </span>
            </div>

            <h1 className={`mv-serif mv-fade mv-d2`} style={{
              fontSize: 'clamp(28px, 2.8vw, 42px)',
              color: 'white',
              fontWeight: 400,
              lineHeight: 1.22,
              marginBottom: '20px',
              letterSpacing: '-0.01em',
            }}>
              Coordinating care,<br />
              <em style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>empowering</em><br />
              volunteers.
            </h1>

            <p className={`mv-fade mv-d3`} style={{
              fontSize: '14.5px',
              color: 'rgba(255,255,255,0.45)',
              lineHeight: 1.75,
              maxWidth: '300px',
              fontWeight: 300,
            }}>
              Manage onboarding, shifts, credentials, and communications — all in one place.
            </p>
          </div>

          {/* Stats + EKG */}
          <div className={`mv-fade mv-d4`} style={{ position: 'relative', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '28px' }}>
            <svg width="100%" height="36" viewBox="0 0 320 36" preserveAspectRatio="none"
              style={{ marginBottom: '22px', opacity: 0.35 }}>
              <polyline
                className="mv-ekg"
                points="0,18 44,18 58,18 66,4 73,32 80,6 87,28 94,18 140,18 154,18 162,4 169,32 176,6 183,28 190,18 236,18 250,18 258,4 265,32 272,6 279,28 286,18 320,18"
                fill="none" stroke={TEAL} strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
            <div style={{ display: 'flex', gap: '28px' }}>
              {[
                { value: '2,400+', label: 'Volunteers' },
                { value: '98%',    label: 'Completion rate' },
                { value: '60+',    label: 'Partner sites' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div className="mv-serif" style={{ fontSize: '18px', color: 'white', fontWeight: 500 }}>{value}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px', letterSpacing: '0.03em' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────── */}
        <div className="mv-right" style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
          background: 'white',
        }}>
          <div style={{ width: '100%', maxWidth: '360px' }}>

            {/* Logo (always visible; on desktop it echoes left panel) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '44px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: NAVY,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Heart style={{ width: '18px', height: '18px', color: 'white', fill: 'white' }} />
              </div>
              <span className="mv-serif" style={{ fontSize: '17px', color: NAVY, fontWeight: 500 }}>MedVolunteer</span>
            </div>

            {/* Heading */}
            <div className="mv-fade mv-d1" style={{ marginBottom: '36px' }}>
              <h2 className="mv-serif" style={{
                fontSize: '28px', color: '#111827', fontWeight: 400,
                letterSpacing: '-0.02em', marginBottom: '6px',
              }}>
                Welcome back
              </h2>
              <p style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 400 }}>
                Sign in to your coordinator account
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="mv-fade mv-d2">

              {/* Email field */}
              <div style={{ position: 'relative', marginBottom: '32px' }}>
                <label className={`mv-label${emailFocused || email ? ' up' : ''}`}>
                  Email address
                </label>
                <input
                  className="mv-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  required
                  autoComplete="email"
                />
                <div className="mv-underline" style={{ width: emailFocused ? '100%' : '0%' }} />
              </div>

              {/* Password field */}
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <label className={`mv-label${passwordFocused || password ? ' up' : ''}`}>
                  Password
                </label>
                <input
                  className="mv-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
                  autoComplete="current-password"
                />
                <div className="mv-underline" style={{ width: passwordFocused ? '100%' : '0%' }} />
              </div>

              {/* Forgot password link */}
              <div style={{ textAlign: 'right', marginBottom: '28px' }}>
                <span style={{ fontSize: '12px', color: TEAL, cursor: 'pointer', fontWeight: 500 }}>
                  Forgot password?
                </span>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: '13px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}>
                  <svg style={{ flexShrink: 0, marginTop: '1px' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button className="mv-btn" type="submit" disabled={loading}>
                <span>
                  {loading ? (
                    <>
                      <svg className="mv-spinner" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight style={{ width: '15px', height: '15px' }} />
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Footer note */}
            <p className="mv-fade mv-d3" style={{
              marginTop: '32px',
              fontSize: '12px',
              color: '#d1d5db',
              textAlign: 'center',
              lineHeight: 1.65,
            }}>
              Access is restricted to authorized coordinators.<br />
              Contact your administrator for account access.
            </p>
          </div>
        </div>

      </div>
    </>
  )
}
