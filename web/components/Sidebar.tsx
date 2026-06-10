'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useContext } from 'react'
import {
  LayoutDashboard, Users, Calendar, FolderOpen,
  BarChart2, MessageSquare, Settings, LogOut, Bell, BookOpen,
} from 'lucide-react'
import { useAdminT, AdminLangContext, AdminSetLangContext } from '@/lib/admin-lang'
import type { AdminLang } from '@/lib/admin-lang'

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useAdminT()
  const lang = useContext(AdminLangContext)
  const setLang = useContext(AdminSetLangContext)

  const nav = [
    { href: '/dashboard',             label: t('nav_dashboard'),  icon: LayoutDashboard },
    { href: '/dashboard/volunteers',  label: t('nav_volunteers'), icon: Users },
    { href: '/dashboard/shifts',      label: t('nav_shifts'),     icon: Calendar },
    { href: '/dashboard/documents',   label: t('nav_documents'),  icon: FolderOpen },
    { href: '/dashboard/reports',     label: t('nav_reports'),    icon: BarChart2 },
    { href: '/dashboard/messages',    label: t('nav_messages'),   icon: MessageSquare },
    { href: '/dashboard/alerts',      label: t('nav_alerts'),     icon: Bell },
    { href: '/dashboard/settings',    label: t('nav_settings'),   icon: Settings },
    { href: '/dashboard/learning',    label: t('nav_learning'),   icon: BookOpen },
  ]

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Clear SW-cached pages so admin data doesn't linger on shared devices
    if ('caches' in window) {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      } catch { /* cache cleanup is best-effort */ }
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <aside style={{
      width: '224px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(175deg, #1e3054 0%, #141f38 100%)',
      flexShrink: 0,
      position: 'relative',
      overflowY: 'auto',
    }}>
      {/* Subtle dot-grid texture */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
        pointerEvents: 'none',
      }} />

      {/* Right border */}
      <div style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0,
        width: '1px',
        background: 'rgba(255,255,255,0.05)',
        pointerEvents: 'none',
      }} />

      {/* ── Logo ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '20px 16px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
      }}>
        <div style={{
          width: '40px', height: '40px',
          borderRadius: '12px',
          background: 'white',
          border: '1px solid rgba(0,172,193,0.28)',
          overflow: 'hidden',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,172,193,0.15)',
        }}>
          <Image
            src="/icons/hummingbird.png"
            alt="MedVolunteer"
            width={40}
            height={40}
            unoptimized
            priority
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
        <div>
          <span style={{
            display: 'block',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '12px',
            color: 'white',
            lineHeight: 1.25,
            letterSpacing: '-0.01em',
          }}>
            Yakima Free Clinic
          </span>
          <span style={{
            display: 'block',
            fontSize: '9px',
            color: 'rgba(255,255,255,0.3)',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginTop: '3px',
          }}>
            {t('admin_portal')}
          </span>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '1px', position: 'relative' }}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`sidebar-nav-item${active ? ' sidebar-nav-active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: active ? 600 : 500,
                color: active ? 'white' : 'rgba(255,255,255,0.48)',
                background: active
                  ? 'linear-gradient(90deg, rgba(0,172,193,0.16) 0%, rgba(255,255,255,0.06) 100%)'
                  : 'transparent',
                boxShadow: active ? 'inset 3px 0 0 #00ACC1' : 'none',
                textDecoration: 'none',
                transition: 'all 0.15s',
              }}
            >
              <Icon style={{
                width: '15px', height: '15px',
                flexShrink: 0,
                opacity: active ? 1 : 0.6,
                color: active ? '#00ACC1' : 'currentColor',
              }} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* ── Language toggle ── */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
      }}>
        <p style={{
          fontSize: '9px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '7px',
        }}>
          {t('language')}
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['en', 'es'] as AdminLang[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: '6px',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                background: lang === l ? '#00ACC1' : 'rgba(255,255,255,0.08)',
                color: lang === l ? 'white' : 'rgba(255,255,255,0.4)',
                boxShadow: lang === l ? '0 1px 4px rgba(0,172,193,0.35)' : 'none',
              }}
            >
              {l === 'en' ? 'English' : 'Español'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sign out ── */}
      <div style={{ padding: '6px 10px 10px', position: 'relative' }}>
        <button
          onClick={handleSignOut}
          className="sidebar-signout"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.3)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
        >
          <LogOut style={{ width: '15px', height: '15px', opacity: 0.45 }} />
          {t('sign_out')}
        </button>
      </div>
    </aside>
  )
}
