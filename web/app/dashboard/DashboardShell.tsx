'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Image from 'next/image'
import Sidebar from '@/components/Sidebar'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--surface-bg)' }}>

      {/* ── Mobile overlay backdrop ── */}
      {open && (
        <div
          className="dash-overlay"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar (drawer on mobile, inline on desktop) ── */}
      <div className={`dash-sidebar-wrap${open ? ' dash-sidebar-open' : ''}`}>
        <Sidebar onClose={() => setOpen(false)} />
      </div>

      {/* ── Main area ── */}
      <div className="dash-main">

        {/* Mobile top bar — hidden on desktop */}
        <div className="dash-topbar">
          <button
            className="dash-hamburger"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px',
              borderRadius: '8px',
              overflow: 'hidden',
              flexShrink: 0,
              border: '1px solid rgba(0,172,193,0.2)',
            }}>
              <Image
                src="/icons/hummingbird.png"
                alt=""
                width={28}
                height={28}
                unoptimized
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <span className="dash-topbar-brand">Yakima Free Clinic</span>
          </div>
        </div>

        {/* Scrollable page content */}
        <main className="dash-scroll">
          {children}
        </main>
      </div>

    </div>
  )
}
