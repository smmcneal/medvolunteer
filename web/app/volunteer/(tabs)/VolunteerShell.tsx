'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { Volunteer } from '@/types/database'

// Detect iOS Safari (where beforeinstallprompt doesn't fire)
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua)
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua)
  return isIOS && isSafari
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
}

const TABS = [
  { href: '/volunteer/home',     label: 'Home',     icon: HomeIcon },
  { href: '/volunteer/shifts',   label: 'Shifts',   icon: CalendarIcon },
  { href: '/volunteer/learn',    label: 'Learn',    icon: BookIcon },
  { href: '/volunteer/profile',  label: 'Profile',  icon: UserIcon },
  { href: '/volunteer/messages', label: 'Messages', icon: MessageIcon },
]

interface Props {
  volunteer: Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'status' | 'category'>
  children: React.ReactNode
}

export default function VolunteerShell({ volunteer, children }: Props) {
  const pathname = usePathname()

  // ── Install prompt state ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deferredPrompt = useRef<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)

  // Register the service worker and handle install prompts once on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] Registered, scope:', reg.scope))
        .catch((err) => console.warn('[SW] Registration failed:', err))
    }

    // Don't show if already installed
    if (isInStandaloneMode()) return

    // Check if user previously dismissed
    if (sessionStorage.getItem('install-dismissed')) return

    if (isIOSSafari()) {
      // iOS Safari: show manual instructions
      setShowIOSHint(true)
    } else {
      // Chrome / Edge / Android: listen for beforeinstallprompt
      const handler = (e: Event) => {
        e.preventDefault()
        deferredPrompt.current = e
        setShowInstallBanner(true)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  function handleInstall() {
    if (!deferredPrompt.current) return
    deferredPrompt.current.prompt()
    deferredPrompt.current.userChoice.then(() => {
      deferredPrompt.current = null
      setShowInstallBanner(false)
    })
  }

  function dismissBanner() {
    sessionStorage.setItem('install-dismissed', '1')
    setShowInstallBanner(false)
    setShowIOSHint(false)
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { background: #f4f5f7; font-family: 'Figtree', system-ui, sans-serif; }
        ::-webkit-scrollbar { display: none; }
        a { text-decoration: none; color: inherit; }
      `}</style>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: '#f4f5f7',
        fontFamily: "'Figtree', system-ui, sans-serif",
      }}>
        {/* Scrollable page content */}
        <main style={{
          flex: 1,
          overflow: 'auto',
          // Pad bottom so content isn't hidden under the tab bar
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom))',
        }}>
          {children}
        </main>

        {/* ── Install banner (Chrome/Android) ── */}
        {showInstallBanner && (
          <div style={{
            position: 'fixed',
            bottom: 'calc(64px + env(safe-area-inset-bottom))',
            left: '12px',
            right: '12px',
            background: '#1B2A4A',
            borderRadius: '14px',
            padding: '14px 14px 14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 99,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#00897B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v13m0 0l-4-4m4 4l4-4"/>
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '2px' }}>
                Add to Home Screen
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                Get the full app experience
              </div>
            </div>
            <button
              onClick={handleInstall}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#00897B',
                border: 'none',
                color: 'white',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              Install
            </button>
            <button
              onClick={dismissBanner}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.5)',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}

        {/* ── Install hint (iOS Safari) ── */}
        {showIOSHint && (
          <div style={{
            position: 'fixed',
            bottom: 'calc(64px + env(safe-area-inset-bottom))',
            left: '12px',
            right: '12px',
            background: '#1B2A4A',
            borderRadius: '14px',
            padding: '14px 14px 14px 16px',
            zIndex: 99,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
                Add to Home Screen
              </div>
              <button
                onClick={dismissBanner}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  marginTop: '-2px',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: '1.6' }}>
              Tap the{' '}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', display: 'inline' }}>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              {' '}Share button, then choose <strong style={{ color: 'white' }}>"Add to Home Screen"</strong> to install MedVolunteer.
            </div>
          </div>
        )}

        {/* Bottom tab bar */}
        <nav
          aria-label="Main navigation"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'white',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            paddingBottom: 'env(safe-area-inset-bottom)',
            zIndex: 100,
            boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
          }}>
          {TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  padding: '10px 0',
                  minHeight: '56px',
                  color: isActive ? '#1B2A4A' : '#9ca3af',
                  transition: 'color 0.15s',
                }}
              >
                <Icon active={isActive} />
                <span aria-hidden="true" style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '0.02em',
                  lineHeight: 1,
                }}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}

// ─── Tab icons (inline SVG for zero-dependency) ────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#1B2A4A' : 'none'} stroke={active ? '#1B2A4A' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1B2A4A' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      {active && <rect x="8" y="14" width="3" height="3" rx="0.5" fill="#1B2A4A"/>}
    </svg>
  )
}

function BookIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1B2A4A' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      {active && <><line x1="8" y1="7" x2="16" y2="7" stroke="white" strokeWidth="1.5"/><line x1="8" y1="11" x2="13" y2="11" stroke="white" strokeWidth="1.5"/></>}
    </svg>
  )
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#1B2A4A' : 'none'} stroke={active ? '#1B2A4A' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4" fill={active ? '#1B2A4A' : 'none'} stroke={active ? '#1B2A4A' : '#9ca3af'}/>
    </svg>
  )
}

function MessageIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#1B2A4A' : 'none'} stroke={active ? '#1B2A4A' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
