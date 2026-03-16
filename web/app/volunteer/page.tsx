import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const NAVY = '#1B2A4A'
const TEAL = '#00897B'

// ─── Page ──────────────────────────────────────────────────────────────────────
// Public landing page for /volunteer/
// — If the user is authenticated AND has a volunteer record, redirect to the app.
// — Admins (authenticated but no volunteer row) fall through to the landing page,
//   avoiding a redirect loop with the tabs layout which redirects non-volunteers to /.
// — Unauthenticated users see the landing page with a Sign In CTA.

export default async function VolunteerLandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Only send to the app if the user actually has a volunteer record
    const { data: volunteer } = await supabase
      .from('volunteers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (volunteer) redirect('/volunteer/home')
    // Authenticated with no volunteer record (admin) → fall through to landing page
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Figtree:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .vl-root {
          font-family: 'Figtree', system-ui, sans-serif;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: ${NAVY};
        }
        .vl-serif { font-family: 'Playfair Display', Georgia, serif; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          14%  { transform: scale(1.2); }
          28%  { transform: scale(1); }
          42%  { transform: scale(1.1); }
          56%  { transform: scale(1); }
        }
        @keyframes drawEkg {
          from { stroke-dashoffset: 600; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1);   opacity: 0.4; }
          100% { transform: scale(2.4); opacity: 0; }
        }

        .vl-fade  { animation: fadeUp 0.55s ease both; }
        .vl-d1    { animation-delay: 0.05s; }
        .vl-d2    { animation-delay: 0.18s; }
        .vl-d3    { animation-delay: 0.30s; }
        .vl-d4    { animation-delay: 0.42s; }
        .vl-d5    { animation-delay: 0.54s; }

        .vl-heart { animation: heartbeat 2.5s ease-in-out infinite; }

        .vl-ekg {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: drawEkg 3s ease forwards;
          animation-delay: 0.7s;
        }

        .vl-ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.06);
          animation: pulseRing 4s cubic-bezier(0.215,0.61,0.355,1) infinite;
        }
        .vl-ring-2 { animation-delay: 1.4s; border-color: rgba(0,137,123,0.18); }

        /* Sign-in button */
        .vl-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 16px 24px;
          background: ${TEAL};
          color: white;
          border: none; border-radius: 14px;
          font-family: 'Figtree', system-ui, sans-serif;
          font-size: 16px; font-weight: 700;
          text-decoration: none;
          transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
          letter-spacing: 0.01em;
        }
        .vl-btn:hover {
          background: #00786e;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0,137,123,0.4);
        }
        .vl-btn:active { transform: translateY(0); box-shadow: none; }

        /* Feature pill */
        .vl-pill {
          display: flex; align-items: center; gap: 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 12px 16px;
        }
      `}</style>

      <div className="vl-root">

        {/* ── TOP DECORATION ───────────────────────────── */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '300px', height: '300px',
          pointerEvents: 'none',
        }}>
          <div className="vl-ring" />
          <div className="vl-ring vl-ring-2" />
        </div>
        <div style={{
          position: 'absolute', bottom: '20%', left: '-60px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'rgba(0,137,123,0.06)',
          border: '1px solid rgba(0,137,123,0.1)',
          pointerEvents: 'none',
        }} />

        {/* ── CONTENT ──────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 'env(safe-area-inset-top, 0px) 28px env(safe-area-inset-bottom, 0px)',
          paddingTop: 'max(env(safe-area-inset-top, 0px), 48px)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 40px)',
          maxWidth: '480px',
          margin: '0 auto',
          width: '100%',
          position: 'relative',
        }}>

          {/* Logo row */}
          <div className="vl-fade vl-d1" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: TEAL,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg className="vl-heart" width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <span className="vl-serif" style={{ fontSize: '18px', color: 'white', fontWeight: 500, letterSpacing: '-0.01em' }}>
              MedVolunteer
            </span>
          </div>

          {/* Hero */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 0 32px' }}>

            {/* Badge */}
            <div className="vl-fade vl-d1" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'rgba(0,137,123,0.14)',
              border: '1px solid rgba(0,137,123,0.3)',
              borderRadius: '20px', padding: '5px 12px',
              marginBottom: '24px', width: 'fit-content',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: TEAL }} />
              <span style={{ fontSize: '10px', color: 'rgba(0,210,190,0.9)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Volunteer Portal
              </span>
            </div>

            <h1 className="vl-serif vl-fade vl-d2" style={{
              fontSize: 'clamp(30px, 8vw, 44px)',
              color: 'white',
              fontWeight: 400,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              marginBottom: '16px',
            }}>
              Your shifts,<br />
              <em style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>your schedule.</em>
            </h1>

            <p className="vl-fade vl-d3" style={{
              fontSize: '15px',
              color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.75,
              fontWeight: 300,
              marginBottom: '36px',
              maxWidth: '320px',
            }}>
              Clock in, complete training, track your hours,
              and stay connected — all from your phone.
            </p>

            {/* Feature pills */}
            <div className="vl-fade vl-d3" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '40px' }}>
              {[
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  ),
                  label: 'View & manage upcoming shifts',
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  ),
                  label: 'Clock in / out with geolocation',
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                  ),
                  label: 'Complete training & onboarding',
                },
              ].map(({ icon, label }) => (
                <div key={label} className="vl-pill">
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '8px',
                    background: `${TEAL}1a`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {icon}
                  </div>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* EKG */}
            <div className="vl-fade vl-d4" style={{ marginBottom: '40px', opacity: 0.25 }}>
              <svg width="100%" height="24" viewBox="0 0 320 24" preserveAspectRatio="none">
                <polyline
                  className="vl-ekg"
                  points="0,12 44,12 58,12 66,2 73,22 80,4 87,20 94,12 140,12 154,12 162,2 169,22 176,4 183,20 190,12 236,12 250,12 258,2 265,22 272,4 279,20 286,12 320,12"
                  fill="none" stroke={TEAL} strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* CTA block */}
          <div className="vl-fade vl-d5">
            <Link href="/volunteer/login" className="vl-btn">
              Sign in to your account
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>

            <p style={{
              textAlign: 'center',
              marginTop: '20px',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.28)',
              lineHeight: 1.6,
            }}>
              Access is by invitation only.{' '}
              <Link href="/login" style={{
                color: 'rgba(255,255,255,0.4)',
                textDecoration: 'none',
                fontWeight: 500,
                borderBottom: '1px solid rgba(255,255,255,0.2)',
              }}>
                Admin login →
              </Link>
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
