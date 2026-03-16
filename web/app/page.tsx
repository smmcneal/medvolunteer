import Link from 'next/link'

const NAVY = '#1B2A4A'
const TEAL = '#00897B'

// ─── Static data ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Volunteer Management',
    body: 'Onboard applicants with guided workflows, track credentials, background checks, and keep every volunteer profile up to date.',
    color: NAVY,
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    title: 'Shift Scheduling',
    body: 'Build and manage shifts across multiple locations. Assign volunteers, track check-ins, and see real-time attendance in a visual calendar.',
    color: TEAL,
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
    title: 'Training & Learning',
    body: 'Create video, text, and quiz modules. Assign content by volunteer category and track completion rates across your whole program.',
    color: '#3B82F6',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: 'Reports & Analytics',
    body: 'Monitor hours logged, onboarding completion, background check status, and expiring credentials — all exportable to CSV.',
    color: '#8B5CF6',
  },
]

const STATS = [
  { value: '2,400+', label: 'Volunteers managed' },
  { value: '98%',    label: 'Onboarding completion' },
  { value: '60+',    label: 'Partner locations' },
  { value: '5 tabs', label: 'Mobile-first PWA' },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Figtree:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Figtree', system-ui, sans-serif; background: #fafafa; }

        .mv-serif  { font-family: 'Playfair Display', Georgia, serif; }
        .mv-sans   { font-family: 'Figtree', system-ui, sans-serif; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          14%  { transform: scale(1.18); }
          28%  { transform: scale(1); }
          42%  { transform: scale(1.1); }
          56%  { transform: scale(1); }
        }
        @keyframes drawEkg {
          from { stroke-dashoffset: 1200; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%  { transform: translateY(-8px); }
        }

        .mv-fade     { animation: fadeUp 0.6s ease both; }
        .mv-d1       { animation-delay: 0.05s; }
        .mv-d2       { animation-delay: 0.15s; }
        .mv-d3       { animation-delay: 0.25s; }
        .mv-d4       { animation-delay: 0.35s; }
        .mv-d5       { animation-delay: 0.45s; }

        .mv-heart    { animation: heartbeat 2.5s ease-in-out infinite; }
        .mv-float    { animation: float 4s ease-in-out infinite; }
        .mv-ekg {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: drawEkg 3.5s ease forwards;
          animation-delay: 0.8s;
        }

        /* Nav */
        .mv-nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 40px; height: 68px;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #f0f0f0;
        }
        .mv-nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }

        .mv-btn-outline {
          padding: 9px 20px;
          border: 1.5px solid #e5e7eb;
          border-radius: 8px;
          font-family: 'Figtree', system-ui, sans-serif;
          font-size: 13px; font-weight: 600;
          color: #374151;
          background: white;
          text-decoration: none;
          transition: border-color 0.2s, color 0.2s;
        }
        .mv-btn-outline:hover { border-color: ${NAVY}; color: ${NAVY}; }

        .mv-btn-primary {
          padding: 9px 20px;
          background: ${NAVY};
          border: 1.5px solid ${NAVY};
          border-radius: 8px;
          font-family: 'Figtree', system-ui, sans-serif;
          font-size: 13px; font-weight: 600;
          color: white;
          text-decoration: none;
          transition: background 0.2s, transform 0.15s, box-shadow 0.15s;
        }
        .mv-btn-primary:hover {
          background: #162239;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(27,42,74,0.25);
        }

        /* Feature cards */
        .mv-card {
          background: white;
          border: 1px solid #f0f0f0;
          border-radius: 16px;
          padding: 28px;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .mv-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.07);
          border-color: #e5e7eb;
        }

        /* Portal cards */
        .mv-portal {
          border-radius: 20px;
          padding: 36px;
          flex: 1;
          min-width: 0;
          text-decoration: none;
          display: block;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .mv-portal:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 48px rgba(0,0,0,0.12);
        }

        @media (max-width: 768px) {
          .mv-nav  { padding: 0 20px; }
          .mv-nav-links { display: none !important; }
          .mv-hero-text { padding: 0 20px !important; }
          .mv-features-grid { grid-template-columns: 1fr 1fr !important; }
          .mv-portal-row { flex-direction: column !important; }
          .mv-stats-row { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .mv-features-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="mv-sans" style={{ minHeight: '100vh', background: '#fafafa' }}>

        {/* ── NAV ──────────────────────────────────────────────────────────── */}
        <nav className="mv-nav">
          <Link href="/" className="mv-nav-logo">
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: NAVY,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg className="mv-heart" width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <span className="mv-serif" style={{ fontSize: '17px', color: NAVY, fontWeight: 500 }}>
              MedVolunteer
            </span>
          </Link>

          <div className="mv-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link href="/volunteer" className="mv-btn-outline">
              Volunteer Portal
            </Link>
            <Link href="/login" className="mv-btn-primary">
              Admin Login
            </Link>
          </div>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section style={{
          background: NAVY,
          position: 'relative',
          overflow: 'hidden',
          padding: '80px 40px 96px',
        }}>
          {/* Background decoration */}
          <div style={{
            position: 'absolute', top: '-120px', right: '-120px',
            width: '520px', height: '520px', borderRadius: '50%',
            background: 'rgba(0,137,123,0.07)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: '-60px', left: '5%',
            width: '280px', height: '280px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.05)',
            pointerEvents: 'none',
          }} />

          <div className="mv-hero-text" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>

            {/* Badge */}
            <div className="mv-fade mv-d1" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'rgba(0,137,123,0.14)',
              border: '1px solid rgba(0,137,123,0.3)',
              borderRadius: '20px', padding: '5px 14px',
              marginBottom: '28px',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: TEAL }} />
              <span style={{ fontSize: '11px', color: 'rgba(0,210,190,0.9)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Medical Volunteer Management
              </span>
            </div>

            {/* Headline */}
            <h1 className="mv-serif mv-fade mv-d2" style={{
              fontSize: 'clamp(32px, 5vw, 58px)',
              color: 'white',
              fontWeight: 400,
              lineHeight: 1.18,
              letterSpacing: '-0.02em',
              marginBottom: '24px',
            }}>
              Coordinating care,<br />
              <em style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>empowering</em> volunteers.
            </h1>

            {/* Sub */}
            <p className="mv-fade mv-d3" style={{
              fontSize: 'clamp(15px, 1.8vw, 18px)',
              color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.75,
              fontWeight: 300,
              maxWidth: '560px',
              margin: '0 auto 40px',
            }}>
              One platform to onboard volunteers, schedule shifts, deliver training,
              and keep your whole program running smoothly.
            </p>

            {/* CTAs */}
            <div className="mv-fade mv-d4" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/login" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '14px 28px',
                background: TEAL,
                borderRadius: '10px',
                color: 'white',
                fontWeight: 700,
                fontSize: '15px',
                textDecoration: 'none',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}>
                Admin Dashboard
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
              <Link href="/volunteer" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '14px 28px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                color: 'rgba(255,255,255,0.85)',
                fontWeight: 600,
                fontSize: '15px',
                textDecoration: 'none',
              }}>
                Volunteer App
              </Link>
            </div>

            {/* EKG */}
            <div className="mv-fade mv-d5" style={{ marginTop: '56px', opacity: 0.3 }}>
              <svg width="100%" height="32" viewBox="0 0 480 32" preserveAspectRatio="none">
                <polyline
                  className="mv-ekg"
                  points="0,16 60,16 80,16 93,3 103,29 113,4 123,26 133,16 200,16 213,16 226,3 236,29 246,4 256,26 266,16 340,16 353,3 363,29 373,4 383,26 393,16 480,16"
                  fill="none" stroke={TEAL} strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* ── STATS ────────────────────────────────────────────────────────── */}
        <section style={{ background: 'white', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 40px' }}>
            <div className="mv-stats-row" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0',
            }}>
              {STATS.map(({ value, label }, i) => (
                <div key={label} style={{
                  padding: '32px 24px',
                  textAlign: 'center',
                  borderRight: i < STATS.length - 1 ? '1px solid #f0f0f0' : 'none',
                }}>
                  <p className="mv-serif" style={{ fontSize: '28px', fontWeight: 500, color: NAVY, marginBottom: '4px' }}>
                    {value}
                  </p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500, letterSpacing: '0.03em' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ─────────────────────────────────────────────────────── */}
        <section style={{ padding: '80px 40px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

            <div style={{ textAlign: 'center', marginBottom: '52px' }}>
              <p style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: TEAL, marginBottom: '12px',
              }}>
                Everything you need
              </p>
              <h2 className="mv-serif" style={{
                fontSize: 'clamp(24px, 3vw, 36px)',
                color: '#111827', fontWeight: 400,
                letterSpacing: '-0.02em', lineHeight: 1.25,
              }}>
                Built for medical volunteer programs
              </h2>
            </div>

            <div className="mv-features-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
            }}>
              {FEATURES.map(({ icon, title, body, color }) => (
                <div key={title} className="mv-card">
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '12px',
                    background: `${color}14`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '18px',
                    color,
                  }}>
                    {icon}
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                    {title}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.65, fontWeight: 400 }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TWO PORTALS ──────────────────────────────────────────────────── */}
        <section style={{ padding: '0 40px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <h2 className="mv-serif" style={{
                fontSize: 'clamp(22px, 2.5vw, 30px)',
                color: '#111827', fontWeight: 400, letterSpacing: '-0.02em',
              }}>
                Two portals, one platform
              </h2>
            </div>

            <div className="mv-portal-row" style={{ display: 'flex', gap: '16px' }}>

              {/* Admin portal */}
              <Link href="/login" className="mv-portal" style={{ background: NAVY }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '20px',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  </svg>
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: 'rgba(0,137,123,0.2)', border: '1px solid rgba(0,137,123,0.3)',
                  borderRadius: '6px', padding: '3px 9px', marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '10px', color: 'rgba(0,210,190,0.9)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    For Coordinators
                  </span>
                </div>
                <h3 className="mv-serif" style={{ fontSize: '22px', color: 'white', fontWeight: 400, marginBottom: '10px' }}>
                  Admin Dashboard
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px', fontWeight: 300 }}>
                  Manage volunteers, build onboarding workflows, schedule shifts,
                  create training content, broadcast messages, and view program reports.
                </p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontSize: '13px', color: TEAL, fontWeight: 600,
                }}>
                  Sign in to dashboard
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </div>
              </Link>

              {/* Volunteer portal */}
              <Link href="/volunteer" className="mv-portal" style={{ background: 'white', border: '1px solid #f0f0f0' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: `${TEAL}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '20px',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: `${TEAL}12`, border: `1px solid ${TEAL}30`,
                  borderRadius: '6px', padding: '3px 9px', marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '10px', color: TEAL, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    For Volunteers
                  </span>
                </div>
                <h3 className="mv-serif" style={{ fontSize: '22px', color: '#111827', fontWeight: 400, marginBottom: '10px' }}>
                  Volunteer App
                </h3>
                <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7, marginBottom: '24px', fontWeight: 400 }}>
                  View upcoming shifts, clock in and out, complete onboarding steps,
                  take training modules, and stay informed with push notifications.
                </p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontSize: '13px', color: TEAL, fontWeight: 600,
                }}>
                  Open volunteer app
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </div>
              </Link>

            </div>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <footer style={{
          background: NAVY,
          padding: '32px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: TEAL,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <span className="mv-serif" style={{ fontSize: '15px', color: 'white', fontWeight: 500 }}>
              MedVolunteer
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Link href="/login" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontWeight: 500 }}>
              Admin Login
            </Link>
            <Link href="/volunteer" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontWeight: 500 }}>
              Volunteer App
            </Link>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>
              © {new Date().getFullYear()} MedVolunteer
            </span>
          </div>
        </footer>

      </div>
    </>
  )
}
