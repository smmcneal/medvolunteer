'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Calendar, FolderOpen,
  BarChart2, MessageSquare, Settings, LogOut
} from 'lucide-react'

const nav = [
  { href: '/dashboard',             label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/dashboard/volunteers',  label: 'Volunteers', icon: Users },
  { href: '/dashboard/shifts',      label: 'Shifts',     icon: Calendar },
  { href: '/dashboard/documents',   label: 'Documents',  icon: FolderOpen },
  { href: '/dashboard/reports',     label: 'Reports',    icon: BarChart2 },
  { href: '/dashboard/messages',    label: 'Messages',   icon: MessageSquare },
  { href: '/dashboard/settings',    label: 'Settings',   icon: Settings },
]

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
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
            Admin Portal
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

      {/* ── Sign out ── */}
      <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
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
          Sign out
        </button>
      </div>
    </aside>
  )
}
