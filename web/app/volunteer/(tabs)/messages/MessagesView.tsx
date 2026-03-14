'use client'

import { useState, useTransition } from 'react'
import { markMessageRead } from './actions'
import type { InboxItem } from './page'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function channelIcon(channel: string): string {
  return { email: '✉️', sms: '💬', push: '🔔' }[channel] ?? '📨'
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  inbox: InboxItem[]
  unreadCount: number
}

export default function MessagesView({ inbox, unreadCount: initialUnread }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [readSet, setReadSet] = useState<Set<string>>(
    () => new Set(inbox.filter(m => m.readAt).map(m => m.recipientId))
  )
  const [, startTransition] = useTransition()

  const unreadCount = inbox.filter(m => !readSet.has(m.recipientId)).length

  function openMessage(item: InboxItem) {
    setOpenId(item.recipientId)
    if (!readSet.has(item.recipientId)) {
      // Optimistic update
      setReadSet(prev => new Set([...prev, item.recipientId]))
      startTransition(async () => {
        try {
          await markMessageRead(item.recipientId)
        } catch {
          // Revert on failure
          setReadSet(prev => {
            const next = new Set(prev)
            next.delete(item.recipientId)
            return next
          })
        }
      })
    }
  }

  const openMessage_item = inbox.find(m => m.recipientId === openId)

  return (
    <div style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1B2A4A 0%, #243660 100%)',
        padding: 'calc(env(safe-area-inset-top) + 48px) 20px 24px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '10px',
      }}>
        <h1 style={{
          fontSize: '22px',
          fontWeight: 800,
          color: 'white',
          margin: 0,
          letterSpacing: '-0.3px',
        }}>
          Messages
        </h1>
        {unreadCount > 0 && (
          <div style={{
            background: '#00897B',
            color: 'white',
            borderRadius: '999px',
            padding: '2px 8px',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '2px',
          }}>
            {unreadCount} new
          </div>
        )}
      </div>

      {/* ── Inbox List ── */}
      <div style={{ background: 'white', minHeight: 'calc(100dvh - 160px)' }}>
        {inbox.length === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: '#9ca3af',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              No messages yet
            </div>
            <div style={{ fontSize: '13px' }}>
              You&apos;ll receive updates from your organization here.
            </div>
          </div>
        ) : (
          inbox.map((item, idx) => {
            const isRead = readSet.has(item.recipientId)
            const isOpen = openId === item.recipientId
            return (
              <div key={item.recipientId}>
                {/* Message row */}
                <button
                  onClick={() => isOpen ? setOpenId(null) : openMessage(item)}
                  style={{
                    width: '100%',
                    background: isOpen ? '#f8fafc' : isRead ? 'white' : '#f0f9ff',
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    padding: '16px',
                    display: 'flex',
                    gap: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => openMessage(item)}
                >
                  {/* Unread dot */}
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isRead ? 'transparent' : '#00897B',
                    marginTop: '6px',
                    flexShrink: 0,
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '8px',
                      marginBottom: '3px',
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: isRead ? 500 : 700,
                        color: '#111827',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}>
                        {item.subject ?? 'No subject'}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        color: '#9ca3af',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {formatRelativeTime(item.sentAt)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: isRead ? '#9ca3af' : '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {channelIcon(item.channel)} {item.body.slice(0, 100)}
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{
                    background: '#f8fafc',
                    borderBottom: '1px solid #e5e7eb',
                    padding: '16px',
                    borderLeft: '3px solid #00897B',
                  }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#1B2A4A',
                        background: '#e0e7ff',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}>
                        {item.channel}
                      </span>
                      {item.sentAt && (
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                          {new Date(item.sentAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    {item.subject && (
                      <div style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#111827',
                        marginBottom: '10px',
                      }}>
                        {item.subject}
                      </div>
                    )}
                    <div style={{
                      fontSize: '14px',
                      color: '#374151',
                      lineHeight: '1.7',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {item.body}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
