'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Calendar, BookOpen,
  BarChart2, MessageSquare, Settings, LogOut, Heart
} from 'lucide-react'

const nav = [
  { href: '/dashboard',            label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/dashboard/volunteers', label: 'Volunteers', icon: Users },
  { href: '/dashboard/onboarding', label: 'Onboarding', icon: Heart },
  { href: '/dashboard/shifts',     label: 'Shifts',     icon: Calendar },
  { href: '/dashboard/learning',   label: 'Learning',   icon: BookOpen },
  { href: '/dashboard/reports',    label: 'Reports',    icon: BarChart2 },
  { href: '/dashboard/messages',   label: 'Messages',   icon: MessageSquare },
  { href: '/dashboard/settings',   label: 'Settings',   icon: Settings },
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
    <aside className="w-60 flex flex-col border-r border-gray-200 bg-white shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#1B2A4A' }}>
          <Heart className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-sm">MedVolunteer</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                transition-colors font-medium
                ${active
                  ? 'text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              style={active ? { backgroundColor: '#1B2A4A' } : {}}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm
            text-gray-600 hover:bg-gray-100 hover:text-gray-900 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
