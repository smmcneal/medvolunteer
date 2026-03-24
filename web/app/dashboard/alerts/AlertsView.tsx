'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { InternalAlert } from '@/types/database'
import { markAlertRead, markAllAlertsRead } from './actions'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function AlertsView({ alerts: initial }: { alerts: InternalAlert[] }) {
  const router = useRouter()
  const [alerts, setAlerts] = useState<InternalAlert[]>(initial)
  const [isPending, startTransition] = useTransition()

  const unreadCount = alerts.filter(a => !a.is_read).length

  function handleMarkRead(alertId: string) {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a))
    startTransition(async () => { await markAlertRead(alertId) })
  }

  function handleMarkAllRead() {
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
    startTransition(async () => { await markAllAlertsRead() })
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
      {unreadCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button
            onClick={handleMarkAllRead}
            disabled={isPending}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              background: 'white', border: '1px solid #e5e7eb', color: '#374151',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Mark all read
          </button>
        </div>
      )}

      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <p style={{ fontSize: '32px', marginBottom: '12px' }}>🔔</p>
          <p style={{ fontSize: '14px', fontWeight: 600 }}>No alerts yet</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Alerts will appear here when document automation rules are triggered.</p>
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', background: 'white', maxWidth: '680px' }}>
          {alerts.map((alert, idx) => (
            <div
              key={alert.id}
              style={{
                padding: '14px 18px',
                borderBottom: idx < alerts.length - 1 ? '1px solid #f3f4f6' : 'none',
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                background: alert.is_read ? 'white' : '#fefce8',
              }}
            >
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '6px',
                background: alert.is_read ? 'transparent' : '#f59e0b',
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', color: '#111827', marginBottom: '4px' }}>{alert.message}</p>
                {alert.volunteer && (
                  <button
                    onClick={() => router.push(`/dashboard/volunteers/${alert.volunteer!.id}`)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontSize: '12px', color: '#1B2A4A', fontWeight: 600, fontFamily: 'inherit',
                      textDecoration: 'underline',
                    }}
                  >
                    {alert.volunteer.first_name} {alert.volunteer.last_name}
                  </button>
                )}
                <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{timeAgo(alert.created_at)}</p>
              </div>
              {!alert.is_read && (
                <button
                  onClick={() => handleMarkRead(alert.id)}
                  style={{
                    background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px',
                    padding: '4px 10px', fontSize: '11px', fontWeight: 600, color: '#6b7280',
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                  }}
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
