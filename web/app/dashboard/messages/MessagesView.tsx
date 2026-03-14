'use client'

import { useState, useTransition, useMemo } from 'react'
import type { MessageWithRecipients } from './page'
import type { Volunteer, MessageChannel, VolunteerCategory } from '@/types/database'
import { sendMessage } from './actions'

const CHANNEL_CONFIG: Record<MessageChannel, { label: string; icon: string; color: string; desc: string }> = {
  email: { label: 'Email', icon: '✉', color: '#3b82f6', desc: 'Delivered to inbox' },
  sms:   { label: 'SMS', icon: '💬', color: '#10b981', desc: 'Text message' },
  push:  { label: 'Push', icon: '🔔', color: '#8b5cf6', desc: 'App notification' },
}

const CATEGORY_LABELS: Record<VolunteerCategory, string> = {
  medical_professional: 'Medical Professionals',
  support_staff: 'Support Staff',
  admin: 'Administrators',
  trainee: 'Trainees',
  other: 'Other',
}

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  initialMessages: MessageWithRecipients[]
  volunteers: Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'category' | 'status'>[]
}

export default function MessagesView({ initialMessages, volunteers }: Props) {
  const [view, setView] = useState<'compose' | 'detail'>('compose')
  const [selectedMsg, setSelectedMsg] = useState<MessageWithRecipients | null>(null)
  const [channelFilter, setChannelFilter] = useState<MessageChannel | 'all'>('all')

  // Compose state
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [channel, setChannel] = useState<MessageChannel>('email')
  const [recipientType, setRecipientType] = useState<'all' | 'group' | 'individual'>('all')
  const [selectedCategory, setSelectedCategory] = useState<VolunteerCategory | ''>('')
  const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<Set<string>>(new Set())
  const [volunteerSearch, setVolunteerSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Compute recipients preview
  const recipientIds = useMemo(() => {
    if (recipientType === 'all') return volunteers.map(v => v.id)
    if (recipientType === 'group' && selectedCategory) {
      return volunteers.filter(v => v.category === selectedCategory).map(v => v.id)
    }
    if (recipientType === 'individual') return Array.from(selectedVolunteerIds)
    return []
  }, [recipientType, selectedCategory, selectedVolunteerIds, volunteers])

  const filteredMessages = useMemo(() => {
    return initialMessages.filter(m => channelFilter === 'all' || m.channel === channelFilter)
  }, [initialMessages, channelFilter])

  const filteredVolunteers = useMemo(() => {
    const q = volunteerSearch.toLowerCase()
    return volunteers.filter(v =>
      `${v.first_name} ${v.last_name}`.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q)
    )
  }, [volunteers, volunteerSearch])

  function toggleVolunteer(id: string) {
    setSelectedVolunteerIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSend() {
    if (!subject.trim() || !body.trim()) return
    setError(null)
    setSuccessMsg(null)
    startTransition(async () => {
      try {
        await sendMessage({
          subject: subject.trim(),
          body: body.trim(),
          channel,
          recipient_type: recipientType === 'group' ? 'group' : recipientType,
          recipient_volunteer_ids: recipientIds,
        })
        setSuccessMsg(`Message sent to ${recipientIds.length} volunteer${recipientIds.length !== 1 ? 's' : ''}`)
        setSubject('')
        setBody('')
        setSelectedVolunteerIds(new Set())
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to send message')
      }
    })
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left panel — compose + history */}
      <div style={{
        width: '320px',
        flexShrink: 0,
        borderRight: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
        overflow: 'hidden',
      }}>
        {/* Compose button */}
        <div style={{ padding: '12px 16px', flexShrink: 0 }}>
          <button
            onClick={() => { setView('compose'); setSelectedMsg(null) }}
            style={{
              width: '100%',
              padding: '9px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: '#1B2A4A',
              color: 'white',
              letterSpacing: '0.02em',
            }}
          >✏ Compose New Message</button>
        </div>

        {/* Channel filter */}
        <div style={{ display: 'flex', gap: '4px', padding: '0 12px 8px', flexShrink: 0 }}>
          {(['all', 'email', 'sms', 'push'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              style={{
                flex: 1,
                padding: '4px 0',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid',
                cursor: 'pointer',
                background: channelFilter === ch ? '#1B2A4A' : 'white',
                borderColor: channelFilter === ch ? '#1B2A4A' : '#e5e7eb',
                color: channelFilter === ch ? 'white' : '#6b7280',
                textTransform: 'uppercase',
              }}
            >{ch}</button>
          ))}
        </div>

        {/* Message history */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredMessages.length === 0 && (
            <p style={{ padding: '20px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
              No messages sent yet.
            </p>
          )}
          {filteredMessages.map(msg => {
            const ch = CHANNEL_CONFIG[msg.channel as MessageChannel]
            const isSelected = selectedMsg?.id === msg.id
            const deliveryPct = msg.recipient_count > 0
              ? Math.round((msg.delivered_count / msg.recipient_count) * 100)
              : 0
            return (
              <div
                key={msg.id}
                onClick={() => { setSelectedMsg(msg); setView('detail') }}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: isSelected ? '#e8edf5' : 'transparent',
                  borderLeft: isSelected ? '3px solid #1B2A4A' : '3px solid transparent',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '3px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {msg.subject || '(No subject)'}
                  </p>
                  <span style={{ fontSize: '10px', color: '#9ca3af', flexShrink: 0, marginTop: '2px' }}>
                    {timeAgo(msg.sent_at ?? msg.created_at ?? '')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: '99px',
                    fontSize: '10px',
                    fontWeight: 600,
                    background: ch.color + '15',
                    color: ch.color,
                  }}>{ch.icon} {ch.label}</span>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>
                    {msg.recipient_count} recipients · {deliveryPct}% delivered
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
        {view === 'compose' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '20px' }}>
              New Message
            </h2>

            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>
                {error}
              </div>
            )}
            {successMsg && (
              <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '13px', color: '#15803d', marginBottom: '16px' }}>
                ✓ {successMsg}
              </div>
            )}

            {/* Channel selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Channel</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(Object.keys(CHANNEL_CONFIG) as MessageChannel[]).map(ch => {
                  const c = CHANNEL_CONFIG[ch]
                  return (
                    <button
                      key={ch}
                      onClick={() => setChannel(ch)}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: '8px',
                        border: '2px solid',
                        cursor: 'pointer',
                        background: channel === ch ? c.color + '10' : 'white',
                        borderColor: channel === ch ? c.color : '#e5e7eb',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '18px', marginBottom: '2px' }}>{c.icon}</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: channel === ch ? c.color : '#374151' }}>{c.label}</div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>{c.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Recipients */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>To</label>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                {(['all', 'group', 'individual'] as const).map(rt => (
                  <button
                    key={rt}
                    onClick={() => { setRecipientType(rt); setSelectedVolunteerIds(new Set()) }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid',
                      cursor: 'pointer',
                      background: recipientType === rt ? '#1B2A4A' : 'white',
                      borderColor: recipientType === rt ? '#1B2A4A' : '#e5e7eb',
                      color: recipientType === rt ? 'white' : '#374151',
                      textTransform: 'capitalize',
                    }}
                  >{rt === 'all' ? 'All Volunteers' : rt === 'group' ? 'By Category' : 'Individuals'}</button>
                ))}
              </div>

              {recipientType === 'all' && (
                <div style={{ padding: '8px 12px', background: '#f0f4ff', borderRadius: '6px', fontSize: '13px', color: '#1B2A4A', fontWeight: 500 }}>
                  📢 Sending to all {volunteers.length} active/onboarding volunteers
                </div>
              )}

              {recipientType === 'group' && (
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value as VolunteerCategory | '')}
                  style={{ ...fieldStyle, marginBottom: '6px' }}
                >
                  <option value="">Select a category…</option>
                  {(Object.keys(CATEGORY_LABELS) as VolunteerCategory[]).map(cat => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]} ({volunteers.filter(v => v.category === cat).length})
                    </option>
                  ))}
                </select>
              )}

              {recipientType === 'individual' && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  <input
                    value={volunteerSearch}
                    onChange={e => setVolunteerSearch(e.target.value)}
                    placeholder="Search volunteers…"
                    style={{ ...fieldStyle, border: 'none', borderBottom: '1px solid #e5e7eb', borderRadius: 0 }}
                  />
                  <div style={{ maxHeight: '160px', overflow: 'auto' }}>
                    {filteredVolunteers.map(v => (
                      <label key={v.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '7px 12px',
                        cursor: 'pointer',
                        background: selectedVolunteerIds.has(v.id) ? '#f0f4ff' : 'transparent',
                        borderBottom: '1px solid #f9fafb',
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedVolunteerIds.has(v.id)}
                          onChange={() => toggleVolunteer(v.id)}
                          style={{ cursor: 'pointer', accentColor: '#1B2A4A' }}
                        />
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0 }}>
                            {v.first_name} {v.last_name}
                          </p>
                          <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{v.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {recipientIds.length > 0 && recipientType !== 'all' && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                  → {recipientIds.length} recipient{recipientIds.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Subject */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Subject</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Message subject"
                style={fieldStyle}
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Message</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message here…"
                rows={8}
                style={{ ...fieldStyle, resize: 'vertical', lineHeight: '1.6' }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!subject.trim() || !body.trim() || recipientIds.length === 0 || isPending}
              style={{
                padding: '11px 28px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: !subject.trim() || !body.trim() || recipientIds.length === 0 ? '#9ca3af' : '#1B2A4A',
                color: 'white',
                opacity: isPending ? 0.7 : 1,
                letterSpacing: '0.02em',
              }}
            >
              {isPending ? 'Sending…' : `Send ${CHANNEL_CONFIG[channel].icon} to ${recipientIds.length} volunteer${recipientIds.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {view === 'detail' && selectedMsg && (
          <MessageDetail msg={selectedMsg} />
        )}

        {view === 'detail' && !selectedMsg && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            Select a message to view details
          </div>
        )}
      </div>
    </div>
  )
}

function MessageDetail({ msg }: { msg: MessageWithRecipients }) {
  const ch = CHANNEL_CONFIG[msg.channel as MessageChannel]
  const deliveryPct = msg.recipient_count > 0
    ? Math.round((msg.delivered_count / msg.recipient_count) * 100)
    : 0
  const readPct = msg.recipient_count > 0
    ? Math.round((msg.read_count / msg.recipient_count) * 100)
    : 0

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
            {msg.subject || '(No subject)'}
          </h2>
          <span style={{
            padding: '3px 10px',
            borderRadius: '99px',
            fontSize: '12px',
            fontWeight: 600,
            background: ch.color + '15',
            color: ch.color,
            flexShrink: 0,
          }}>{ch.icon} {ch.label}</span>
        </div>
        <p style={{ fontSize: '13px', color: '#6b7280' }}>
          Sent {formatDate(msg.sent_at ?? msg.created_at ?? '')}
          {' · '}{msg.recipient_type === 'all' ? 'All volunteers' : msg.recipient_type}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Recipients', value: msg.recipient_count, color: '#6b7280' },
          { label: 'Delivered', value: `${msg.delivered_count} (${deliveryPct}%)`, color: '#10b981' },
          { label: 'Read', value: `${msg.read_count} (${readPct}%)`, color: '#3b82f6' },
        ].map(stat => (
          <div key={stat.label} style={{
            flex: 1,
            padding: '14px 16px',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}>
            <p style={{ fontSize: '20px', fontWeight: 800, color: stat.color, marginBottom: '2px' }}>{stat.value}</p>
            <p style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Message body */}
      <div style={{
        padding: '20px',
        background: '#f9fafb',
        borderRadius: '10px',
        border: '1px solid #e5e7eb',
        fontSize: '14px',
        lineHeight: '1.7',
        color: '#374151',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.body}
      </div>
    </div>
  )
}

// ─── Style atoms ───────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  color: '#111827',
  background: 'white',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}
