'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { signHandbook } from './actions'

interface Props {
  volunteerId: string
  firstName: string
  lastName: string
  signedAt: string | null
  signedName: string | null
}

export default function HandbookView({
  volunteerId,
  firstName,
  lastName,
  signedAt: initialSignedAt,
  signedName: initialSignedName,
}: Props) {
  const [signedAt, setSignedAt]   = useState(initialSignedAt)
  const [signedName, setSignedName] = useState(initialSignedName)

  const [fullName, setFullName]   = useState('')
  const [agreed, setAgreed]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Scroll into view for signature section on smaller screens
  const sigRef = useRef<HTMLDivElement>(null)

  const isSigned = !!signedAt

  function handleSign() {
    if (!fullName.trim()) { setError('Please enter your full name.'); return }
    if (!agreed)          { setError('Please check the acknowledgment box.'); return }
    setError(null)
    startTransition(async () => {
      const result = await signHandbook(volunteerId, fullName.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setSignedAt(new Date().toISOString())
        setSignedName(fullName.trim())
      }
    })
  }

  const formattedDate = signedAt
    ? new Date(signedAt).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : null

  const formattedTime = signedAt
    ? new Date(signedAt).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
      })
    : null

  return (
    <div style={{ paddingBottom: '32px', fontFamily: "'Figtree', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1B2A4A 0%, #243660 100%)',
        padding: 'calc(env(safe-area-inset-top) + 48px) 20px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          {/* Book icon */}
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.3px' }}>
              Volunteer Handbook
            </h1>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: '2px 0 0' }}>
              Please read carefully before signing
            </p>
          </div>
        </div>

        {/* Signed status pill */}
        {isSigned && (
          <div style={{
            marginTop: '12px',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(34,197,94,0.18)',
            border: '1px solid rgba(34,197,94,0.35)',
            borderRadius: '999px',
            padding: '5px 12px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80' }}>
              Signed — {formattedDate}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '16px' }}>

        {/* ── Signed confirmation card ── */}
        {isSigned && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '14px',
            padding: '16px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: '#dcfce7',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#15803d', margin: '0 0 2px' }}>
                Acknowledgment on file
              </p>
              <p style={{ fontSize: '13px', color: '#166534', margin: 0, lineHeight: '1.5' }}>
                Signed by <strong>{signedName}</strong> on {formattedDate} at {formattedTime}
              </p>
            </div>
          </div>
        )}

        {/* ── PDF Viewer ── */}
        <div style={{
          background: 'white',
          borderRadius: '14px',
          border: '1px solid #f0f0f0',
          overflow: 'hidden',
          marginBottom: '14px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {/* PDF toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #f3f4f6',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Volunteer Handbook.pdf</span>
            </div>
            <a
              href="/volunteer-handbook.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '12px', fontWeight: 600, color: '#1B2A4A',
                textDecoration: 'none',
                padding: '5px 10px',
                background: '#f3f4f6',
                borderRadius: '7px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open
            </a>
          </div>

          {/* Iframe PDF embed */}
          <div style={{ position: 'relative', height: '520px', background: '#f9fafb' }}>
            <iframe
              src="/volunteer-handbook.pdf#toolbar=0&navpanes=0"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
              title="Volunteer Handbook"
            />
            {/* Fallback overlay for browsers that don't support inline PDFs */}
            <noscript>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '12px', padding: '20px', textAlign: 'center',
              }}>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  Your browser cannot display the PDF inline.
                </p>
                <a
                  href="/volunteer-handbook.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '10px 20px', background: '#1B2A4A', color: 'white',
                    borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  Open Handbook PDF
                </a>
              </div>
            </noscript>
          </div>
        </div>

        {/* ── Signature section ── */}
        {!isSigned ? (
          <div
            ref={sigRef}
            style={{
              background: 'white',
              borderRadius: '14px',
              border: '1px solid #f0f0f0',
              padding: '20px 16px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
              Acknowledgment &amp; Signature
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 18px', lineHeight: '1.5' }}>
              By signing below, you confirm that you have read the entire Volunteer Handbook and agree to abide by its policies and guidelines.
            </p>

            {/* Acknowledgment checkbox */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              cursor: 'pointer', marginBottom: '18px',
            }}>
              <div
                onClick={() => setAgreed(a => !a)}
                style={{
                  width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                  border: `2px solid ${agreed ? '#1B2A4A' : '#d1d5db'}`,
                  background: agreed ? '#1B2A4A' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', marginTop: '1px', transition: 'all 0.15s',
                }}
              >
                {agreed && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
              <span style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                I, the undersigned, certify that I have read the Volunteer Handbook in its entirety and agree to follow all policies and guidelines outlined within it.
              </span>
            </label>

            {/* Full name input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px', fontWeight: 600, color: '#374151',
                marginBottom: '6px', letterSpacing: '0.02em',
              }}>
                Full Name (as signature)
              </label>
              <input
                type="text"
                placeholder={`${firstName} ${lastName}`}
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                  fontStyle: 'italic',
                  color: '#1B2A4A',
                  outline: 'none',
                  background: '#fafafa',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#1B2A4A' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb' }}
              />
              {fullName.trim() && (
                <div style={{
                  marginTop: '6px', padding: '8px 12px',
                  background: '#f8faff', borderRadius: '7px',
                  border: '1px solid #e0e7ff',
                  fontSize: '17px',
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                  fontStyle: 'italic',
                  color: '#1e40af',
                }}>
                  {fullName.trim()}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '10px 14px', marginBottom: '12px',
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '9px',
                fontSize: '13px', color: '#dc2626',
              }}>
                {error}
              </div>
            )}

            {/* Sign button */}
            <button
              onClick={handleSign}
              disabled={isPending}
              style={{
                width: '100%',
                padding: '15px',
                background: isPending ? '#9ca3af' : '#1B2A4A',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: isPending ? 'default' : 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.15s',
              }}
            >
              {isPending ? (
                'Saving…'
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Sign &amp; Confirm
                </>
              )}
            </button>
          </div>
        ) : (
          /* Already signed — small re-download prompt */
          <div style={{
            background: 'white',
            borderRadius: '14px',
            border: '1px solid #f0f0f0',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>
                Your copy
              </p>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                Keep a copy for your records
              </p>
            </div>
            <a
              href="/volunteer-handbook.pdf"
              download="Volunteer Handbook.pdf"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 14px',
                background: '#1B2A4A', color: 'white',
                borderRadius: '9px',
                fontSize: '13px', fontWeight: 600,
                textDecoration: 'none', flexShrink: 0,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
