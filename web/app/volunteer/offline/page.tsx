'use client'

// This page is pre-cached by the service worker and served when the user
// tries to navigate while offline.
export default function OfflinePage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Offline – MedVolunteer</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Figtree', system-ui, -apple-system, sans-serif;
            background: #f4f5f7;
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px 24px;
            text-align: center;
          }
        `}</style>
      </head>
      <body>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: '#1B2A4A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}>
          {/* Medical cross */}
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="15" y="5" width="10" height="30" rx="2" fill="#00897B"/>
            <rect x="5" y="15" width="30" height="10" rx="2" fill="#00897B"/>
          </svg>
        </div>

        <h1 style={{
          fontSize: '22px',
          fontWeight: 800,
          color: '#111827',
          marginBottom: '8px',
          letterSpacing: '-0.3px',
        }}>
          You&apos;re offline
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#6b7280',
          lineHeight: '1.6',
          maxWidth: '280px',
          marginBottom: '32px',
        }}>
          Check your connection and try again. Pages you&apos;ve visited recently may still be available.
        </p>

        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '14px 28px',
            background: '#1B2A4A',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginBottom: '12px',
            width: '100%',
            maxWidth: '240px',
          }}
        >
          Try again
        </button>

        <button
          onClick={() => window.history.back()}
          style={{
            padding: '14px 28px',
            background: '#f3f4f6',
            color: '#374151',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: '100%',
            maxWidth: '240px',
          }}
        >
          Go back
        </button>
      </body>
    </html>
  )
}
