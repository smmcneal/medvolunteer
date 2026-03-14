'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function VolunteerError({ error, reset }: Props) {
  useEffect(() => {
    // Log to error reporting service in production
    console.error('[MedVolunteer] Volunteer PWA error:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      textAlign: 'center',
      fontFamily: "'Figtree', system-ui, sans-serif",
      background: '#f4f5f7',
    }}>
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '18px',
        background: '#fee2e2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>

      <h1 style={{
        fontSize: '20px',
        fontWeight: 800,
        color: '#111827',
        margin: '0 0 8px',
        letterSpacing: '-0.3px',
      }}>
        Something went wrong
      </h1>
      <p style={{
        fontSize: '14px',
        color: '#6b7280',
        lineHeight: '1.6',
        maxWidth: '280px',
        margin: '0 0 28px',
      }}>
        We hit an unexpected error. Try again, or contact support if the problem persists.
      </p>

      {process.env.NODE_ENV === 'development' && error.message && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '20px',
          maxWidth: '320px',
          textAlign: 'left',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Error (dev only)
          </p>
          <code style={{ fontSize: '12px', color: '#7f1d1d', wordBreak: 'break-all', lineHeight: '1.5' }}>
            {error.message}
          </code>
        </div>
      )}

      <button
        onClick={reset}
        style={{
          width: '100%',
          maxWidth: '240px',
          padding: '14px',
          background: '#1B2A4A',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: '10px',
        }}
      >
        Try again
      </button>
      <button
        onClick={() => window.location.assign('/volunteer/home')}
        style={{
          width: '100%',
          maxWidth: '240px',
          padding: '14px',
          background: '#f3f4f6',
          color: '#374151',
          border: 'none',
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Go to Home
      </button>
    </div>
  )
}
