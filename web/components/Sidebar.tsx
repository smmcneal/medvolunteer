'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Calendar, FolderOpen,
  BarChart2, MessageSquare, Settings, LogOut, Heart
} from 'lucide-react'

const nav = [
  { href: '/dashboard',             label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/dashboard/volunteers',  label: 'Volunteers', icon: Users },
  { href: '/dashboard/onboarding',  label: 'Onboarding', icon: Heart },
  { href: '/dashboard/shifts',      label: 'Shifts',     icon: Calendar },
  { href: '/dashboard/documents',   label: 'Documents',  icon: FolderOpen },
  { href: '/dashboard/reports',     label: 'Reports',    icon: BarChart2 },
  { href: '/dashboard/messages',    label: 'Messages',   icon: MessageSquare },
  { href: '/dashboard/settings',    label: 'Settings',   icon: Settings },
]

export default function Sidebar() {
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
      width: '232px',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #f0f0f0',
      background: 'white',
      flexShrink: 0,
    }}>
      {/* ── Logo ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '18px 20px 16px',
        borderBottom: '1px solid #f5f5f5',
      }}>
        <Image
          src="/icons/hummingbird.svg"
          alt="MedVolunteer"
          width={40}
          height={40}
          style={{ flexShrink: 0 }}
          unoptimized
          priority
        />
        <div>
          <span style={{
            display: 'block',
            fontWeight: 800,
            fontSize: '14px',
            color: '#111827',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
          }}>
            MedVolunteer
          </span>
          <span style={{
            display: 'block',
            fontSize: '10px',
            color: '#9ca3af',
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginTop: '1px',
          }}>
            Admin Portal
          </span>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: active ? 600 : 500,
                color: active ? 'white' : '#6b7280',
                background: active ? '#1B2A4A' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.12s',
              }}
            >
              <Icon style={{ width: '15px', height: '15px', flexShrink: 0 }} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* ── Sign out ── */}
      <div style={{ padding: '10px', borderTop: '1px solid #f5f5f5' }}>
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#9ca3af',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.12s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#f9fafb'
            e.currentTarget.style.color = '#374151'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none'
            e.currentTarget.style.color = '#9ca3af'
          }}
        >
          <LogOut style={{ width: '15px', height: '15px' }} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
