'use client'

import { useState, useTransition, useMemo } from 'react'
import type { MessageWithRecipients } from './page'
import type { Volunteer, MessageChannel, MessageTemplate, Category } from '@/types/database'
import { sendMessage, saveTemplate, deleteTemplate } from './actions'
import { ChevronLeft, Send, CheckCheck, Eye, Users, Inbox, FileText, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { useAdminT } from '@/lib/admin-lang'

// ─── Config ───────────────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<MessageChannel, { label: string; icon: string; color: string; bg: string; desc: string }> = {
  email: { label: 'Email', icon: '✉',  color: '#3b82f6', bg: '#eff6ff', desc: 'Inbox delivery' },
  sms:   { label: 'SMS',   icon: '💬', color: '#10b981', bg: '#f0fdf4', desc: 'Text message'  },
  push:  { label: 'Push',  icon: '🔔', color: '#8b5cf6', bg: '#faf5ff', desc: 'App notify'    },
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  initialMessages: MessageWithRecipients[]
  volunteers: Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'category' | 'status'>[]
  templates: MessageTemplate[]
  categories: Category[]
}

export default function MessagesView({ initialMessages, volunteers, templates, categories }: Props) {
  const t = useAdminT()
  // Mobile panel state — 'list' shows sidebar, 'main' shows compose/detail
  const [mobilePanel, setMobilePanel] = useState<'list' | 'main'>('main')

  const [view, setView] = useState<'compose' | 'detail'>('compose')
  const [selectedMsg, setSelectedMsg] = useState<MessageWithRecipients | null>(null)
  const [channelFilter, setChannelFilter] = useState<MessageChannel | 'all'>('all')

  // Compose state
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [channel, setChannel] = useState<MessageChannel>('email')
  const [recipientType, setRecipientType] = useState<'all' | 'group' | 'individual'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<Set<string>>(new Set())
  const [volunteerSearch, setVolunteerSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Send Later state
  const [sendLater, setSendLater] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')

  // Template state
  const [showTemplates, setShowTemplates] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [isPendingTemplate, startTemplateTransition] = useTransition()
  const [templateError, setTemplateError] = useState<string | null>(null)

  const recipientIds = useMemo(() => {
    if (recipientType === 'all') return volunteers.map(v => v.id)
    if (recipientType === 'group' && selectedCategory)
      return volunteers.filter(v => v.category === selectedCategory).map(v => v.id)
    if (recipientType === 'individual') return Array.from(selectedVolunteerIds)
    return []
  }, [recipientType, selectedCategory, selectedVolunteerIds, volunteers])

  const filteredMessages = useMemo(() =>
    initialMessages.filter(m => channelFilter === 'all' || m.channel === channelFilter),
    [initialMessages, channelFilter]
  )

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
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openDetail(msg: MessageWithRecipients) {
    setSelectedMsg(msg)
    setView('detail')
    setMobilePanel('main')
  }

  function openCompose() {
    setView('compose')
    setSelectedMsg(null)
    setMobilePanel('main')
  }

  function useTemplateInCompose(tmpl: MessageTemplate) {
    setSubject(tmpl.subject)
    setBody(tmpl.body)
    setChannel(tmpl.channel)
    setView('compose')
    setSelectedMsg(null)
    setMobilePanel('main')
  }

  function handleSend() {
    if (!subject.trim() || !body.trim()) return
    if (sendLater && !scheduledAt) return
    setError(null)
    setSuccessMsg(null)
    startTransition(async () => {
      try {
        const scheduledIso = sendLater && scheduledAt ? new Date(scheduledAt).toISOString() : null
        await sendMessage({
          subject: subject.trim(),
          body: body.trim(),
          channel,
          recipient_type: recipientType === 'group' ? 'group' : recipientType,
          recipient_volunteer_ids: recipientIds,
          scheduled_send_at: scheduledIso,
        })
        if (scheduledIso) {
          setSuccessMsg(`Scheduled for ${new Date(scheduledIso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${recipientIds.length} recipient${recipientIds.length !== 1 ? 's' : ''}`)
        } else {
          setSuccessMsg(`Sent to ${recipientIds.length} volunteer${recipientIds.length !== 1 ? 's' : ''}`)
        }
        setSubject('')
        setBody('')
        setSelectedVolunteerIds(new Set())
        setSendLater(false)
        setScheduledAt('')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send message')
      }
    })
  }

  const canSend = !!(subject.trim() && body.trim() && recipientIds.length > 0 && !isPending && (!sendLater || scheduledAt))

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

      {/* ── Left: Message history sidebar ─────────────────────── */}
      <div
        className={`msg-sidebar${mobilePanel === 'list' ? ' msg-panel-active' : ''}`}
      >
        {/* Sidebar top: compose button */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--surface-border-sub)', flexShrink: 0 }}>
          <button
            onClick={openCompose}
            style={{
              width: '100%', padding: '9px 16px', borderRadius: '9px',
              fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer',
              background: 'var(--navy)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              fontFamily: 'inherit', letterSpacing: '-0.01em',
              boxShadow: '0 2px 8px rgba(27,42,74,0.2)',
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
          >
            <span style={{ fontSize: '14px' }}>✏</span> {t('compose_new_message')}
          </button>
        </div>

        {/* Channel filter pills */}
        <div style={{ display: 'flex', gap: '4px', padding: '10px 12px', flexShrink: 0 }}>
          {(['all', 'email', 'sms', 'push'] as const).map(ch => {
            const active = channelFilter === ch
            return (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: '6px',
                  fontSize: '10px', fontWeight: 700, border: '1px solid',
                  cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
                  background: active ? 'var(--navy)' : 'var(--surface-card)',
                  borderColor: active ? 'var(--navy)' : 'var(--surface-border)',
                  color: active ? 'white' : 'var(--text-muted)',
                  fontFamily: 'inherit', transition: 'background 0.12s, color 0.12s',
                }}
              >{ch}</button>
            )
          })}
        </div>

        {/* History count */}
        <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Message list */}
        <div style={{ flex: '1 1 0', overflowY: 'auto', minHeight: 0 }}>
          {filteredMessages.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Inbox style={{ width: '28px', height: '28px', color: 'var(--surface-border)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>{t('no_messages')}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '4px' }}>{t('no_messages_hint')}</p>
            </div>
          )}

          {filteredMessages.map(msg => {
            const ch = CHANNEL_CONFIG[msg.channel as MessageChannel]
            const isSelected = selectedMsg?.id === msg.id
            const deliveryPct = msg.recipient_count > 0
              ? Math.round((msg.delivered_count / msg.recipient_count) * 100) : 0

            return (
              <div
                key={msg.id}
                onClick={() => openDetail(msg)}
                className="msg-history-item"
                style={{
                  padding: '11px 16px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(27,42,74,0.04)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--navy)' : '3px solid transparent',
                  borderBottom: '1px solid var(--surface-border-sub)',
                  transition: 'background 0.1s',
                }}
              >
                {/* Subject + time */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '5px' }}>
                  <p style={{
                    fontSize: '13px', fontWeight: isSelected ? 700 : 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                  }}>
                    {msg.subject || '(No subject)'}
                  </p>
                  <span style={{ fontSize: '10px', color: msg.status === 'scheduled' ? '#7c3aed' : 'var(--text-faint)', flexShrink: 0, marginTop: '2px' }}>
                    {msg.status === 'scheduled' && msg.scheduled_send_at
                      ? new Date(msg.scheduled_send_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : timeAgo(msg.sent_at ?? msg.created_at ?? '')}
                  </span>
                </div>

                {/* Channel badge + stats */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    padding: '1px 7px', borderRadius: '99px',
                    fontSize: '10px', fontWeight: 700,
                    background: ch.color + '18', color: ch.color,
                    letterSpacing: '0.02em',
                  }}>{ch.icon} {ch.label}</span>
                  {msg.status === 'scheduled'
                    ? <span style={{ padding: '1px 7px', borderRadius: '99px', fontSize: '10px', fontWeight: 700, background: '#f5f3ff', color: '#7c3aed' }}>⏰ {t('scheduled_badge')}</span>
                    : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{msg.recipient_count} · {deliveryPct}%</span>
                  }
                </div>
              </div>
            )
          })}
        </div>

        {/* Templates section */}
        <div style={{ borderTop: '1px solid var(--surface-border-sub)', flexShrink: 0 }}>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            style={{
              width: '100%', padding: '10px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700,
              fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText style={{ width: '12px', height: '12px' }} />
              {t('templates')}
              <span style={{
                padding: '1px 6px', borderRadius: '99px', fontSize: '10px',
                background: 'var(--surface-bg)', color: 'var(--text-muted)',
                border: '1px solid var(--surface-border)',
                textTransform: 'none', letterSpacing: 0,
              }}>{templates.length}</span>
            </span>
            {showTemplates
              ? <ChevronDown style={{ width: '13px', height: '13px' }} />
              : <ChevronRight style={{ width: '13px', height: '13px' }} />}
          </button>
          {showTemplates && (
            <div style={{ borderTop: '1px solid var(--surface-border-sub)', maxHeight: 180, overflowY: 'auto' }}>
              {templates.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-faint)', padding: '12px 16px', textAlign: 'center' }}>
                  {t('no_templates_yet')}
                </p>
              ) : templates.map(tmpl => (
                <div
                  key={tmpl.id}
                  style={{
                    padding: '8px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    borderBottom: '1px solid var(--surface-border-sub)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{tmpl.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{tmpl.subject || '(no subject)'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => useTemplateInCompose(tmpl)}
                      style={{
                        padding: '3px 9px', borderRadius: '6px', border: 'none',
                        background: 'var(--navy)', color: 'white',
                        fontSize: '10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        letterSpacing: '0.02em',
                      }}
                    >{t('use_template')}</button>
                    <button
                      onClick={() => startTemplateTransition(async () => { await deleteTemplate(tmpl.id) })}
                      style={{
                        padding: '3px 6px', borderRadius: '6px',
                        border: '1px solid var(--surface-border)',
                        background: 'transparent', color: 'var(--text-muted)',
                        fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      }}
                      title="Delete template"
                    >
                      <Trash2 style={{ width: '11px', height: '11px' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Compose / Detail ────────────────────────────── */}
      <div
        className={`msg-main-panel${mobilePanel === 'main' ? ' msg-panel-active' : ''}`}
      >
        {view === 'compose' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

            {/* Mobile back button */}
            <button
              className="msg-back-btn"
              onClick={() => setMobilePanel('list')}
              style={{ display: 'none' /* shown by CSS on mobile */ }}
            >
              <ChevronLeft style={{ width: '14px', height: '14px' }} />
              {t('messages_title')}
            </button>

            {/* Title */}
            <h2 style={{
              fontSize: '18px', fontWeight: 700,
              color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
              letterSpacing: '-0.025em', lineHeight: 1, marginBottom: '20px',
            }}>
              {t('new_message')}
            </h2>

            {/* Feedback */}
            {error && (
              <div style={{
                padding: '10px 14px', background: '#fef2f2',
                border: '1px solid #fecaca', borderRadius: '8px',
                fontSize: '13px', color: '#dc2626', marginBottom: '16px',
              }}>
                {error}
              </div>
            )}
            {successMsg && (
              <div style={{
                padding: '10px 14px', background: '#f0fdf4',
                border: '1px solid #bbf7d0', borderRadius: '8px',
                fontSize: '13px', color: '#15803d', marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '7px',
              }}>
                <CheckCheck style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                {successMsg}
              </div>
            )}

            {/* Channel */}
            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>{t('channel_label')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {(Object.keys(CHANNEL_CONFIG) as MessageChannel[]).map(ch => {
                  const c = CHANNEL_CONFIG[ch]
                  const active = channel === ch
                  return (
                    <button
                      key={ch}
                      onClick={() => setChannel(ch)}
                      style={{
                        padding: '12px 8px', borderRadius: '10px',
                        border: `2px solid ${active ? c.color : 'var(--surface-border)'}`,
                        cursor: 'pointer', textAlign: 'center',
                        background: active ? c.bg : 'var(--surface-card)',
                        transition: 'border-color 0.15s, background 0.15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{c.icon}</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: active ? c.color : 'var(--text-primary)' }}>{c.label}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>{c.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Recipients */}
            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>{t('to_label')}</label>
              {/* Segmented control */}
              <div style={{
                display: 'inline-flex', borderRadius: '8px',
                border: '1px solid var(--surface-border)',
                overflow: 'hidden', marginBottom: '10px',
                background: 'var(--surface-bg)',
              }}>
                {(['all', 'group', 'individual'] as const).map(rt => (
                  <button
                    key={rt}
                    onClick={() => { setRecipientType(rt); setSelectedVolunteerIds(new Set()) }}
                    style={{
                      padding: '6px 14px', border: 'none', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 600,
                      background: recipientType === rt ? 'var(--navy)' : 'transparent',
                      color: recipientType === rt ? 'white' : 'var(--text-secondary)',
                      fontFamily: 'inherit', transition: 'background 0.12s, color 0.12s',
                    }}
                  >{rt === 'all' ? t('all') : rt === 'group' ? t('by_category_label') : t('individuals_label')}</button>
                ))}
              </div>

              {recipientType === 'all' && (
                <div style={{
                  padding: '10px 14px', background: 'rgba(27,42,74,0.04)',
                  borderRadius: '8px', fontSize: '13px', color: 'var(--navy)',
                  fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
                  border: '1px solid rgba(27,42,74,0.08)',
                }}>
                  <Users style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                  {t('all_volunteers')} — {volunteers.length}
                </div>
              )}

              {recipientType === 'group' && (
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={fieldStyle}
                >
                  <option value="">Select a category…</option>
                  {categories.map(cat => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.name} ({volunteers.filter(v => v.category === cat.slug).length})
                    </option>
                  ))}
                </select>
              )}

              {recipientType === 'individual' && (
                <div style={{ border: '1px solid var(--surface-border)', borderRadius: '9px', overflow: 'hidden', background: 'var(--surface-card)' }}>
                  <input
                    value={volunteerSearch}
                    onChange={e => setVolunteerSearch(e.target.value)}
                    placeholder="Search volunteers…"
                    style={{ ...fieldStyle, border: 'none', borderBottom: '1px solid var(--surface-border-sub)', borderRadius: 0 }}
                  />
                  <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    {filteredVolunteers.map(v => (
                      <label key={v.id} style={{
                        display: 'flex', alignItems: 'center', gap: '9px',
                        padding: '8px 12px', cursor: 'pointer',
                        background: selectedVolunteerIds.has(v.id) ? 'rgba(27,42,74,0.04)' : 'transparent',
                        borderBottom: '1px solid var(--surface-border-sub)',
                        transition: 'background 0.1s',
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedVolunteerIds.has(v.id)}
                          onChange={() => toggleVolunteer(v.id)}
                          style={{ cursor: 'pointer', accentColor: 'var(--navy)', flexShrink: 0 }}
                        />
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                            {v.first_name} {v.last_name}
                          </p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{v.email}</p>
                        </div>
                      </label>
                    ))}
                    {filteredVolunteers.length === 0 && (
                      <p style={{ fontSize: '12px', color: 'var(--text-faint)', padding: '12px', textAlign: 'center' }}>{t('no_results')}</p>
                    )}
                  </div>
                </div>
              )}

              {recipientIds.length > 0 && recipientType !== 'all' && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Users style={{ width: '12px', height: '12px' }} />
                  {recipientIds.length} recipient{recipientIds.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Template selector */}
            {templates.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>{t('templates')}</label>
                <select
                  value=""
                  onChange={e => {
                    const tmpl = templates.find(t => t.id === e.target.value)
                    if (tmpl) useTemplateInCompose(tmpl)
                  }}
                  style={fieldStyle}
                >
                  <option value="">{t('select_template_placeholder') ?? 'Select a template…'}</option>
                  {templates.map(tmpl => (
                    <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Subject */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>{t('subject')}</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Message subject"
                style={fieldStyle}
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>{t('body')}</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message here…"
                rows={8}
                style={{ ...fieldStyle, resize: 'vertical', lineHeight: '1.65' }}
              />
            </div>

            {/* Send Later toggle */}
            <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '9px', background: 'var(--surface-bg)', border: '1px solid var(--surface-border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={sendLater}
                  onChange={e => { setSendLater(e.target.checked); if (!e.target.checked) setScheduledAt('') }}
                  style={{ accentColor: 'var(--navy)', width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('send_later')}</span>
              </label>
              {sendLater && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  onChange={e => setScheduledAt(e.target.value)}
                  style={{
                    marginTop: '10px', width: '100%', padding: '8px 10px',
                    border: '1px solid var(--surface-border)', borderRadius: '7px',
                    fontSize: '13px', color: 'var(--text-primary)',
                    fontFamily: 'inherit', background: 'white', boxSizing: 'border-box',
                  }}
                />
              )}
            </div>

            {/* Send + Save as Template */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <button
                onClick={handleSend}
                disabled={!canSend}
                style={{
                  padding: '11px 24px', borderRadius: '9px',
                  fontSize: '13px', fontWeight: 700, border: 'none',
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  background: canSend ? 'var(--navy)' : 'var(--surface-border)',
                  color: canSend ? 'white' : 'var(--text-faint)',
                  display: 'flex', alignItems: 'center', gap: '7px',
                  fontFamily: 'inherit', letterSpacing: '-0.01em',
                  boxShadow: canSend ? '0 2px 8px rgba(27,42,74,0.2)' : 'none',
                  transition: 'background 0.15s, box-shadow 0.15s',
                }}
              >
                <Send style={{ width: '13px', height: '13px' }} />
                {isPending
                  ? t('sending_msg')
                  : sendLater
                    ? `${t('send_later')} ${CHANNEL_CONFIG[channel].icon} ${recipientIds.length}`
                    : `${t('send')} ${CHANNEL_CONFIG[channel].icon} ${recipientIds.length}`}
              </button>
              <button
                onClick={() => { setSavingTemplate(true); setTemplateName(''); setTemplateError(null) }}
                style={{
                  padding: '11px 18px', borderRadius: '9px',
                  border: '1px solid var(--surface-border)',
                  background: 'var(--surface-card)', color: 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontFamily: 'inherit',
                }}
              >
                <FileText style={{ width: '13px', height: '13px' }} />
                {t('save_template')}
              </button>
            </div>

            {/* Save template inline form */}
            {savingTemplate && (
              <div style={{ marginTop: '12px', padding: '12px 14px', borderRadius: '9px', background: 'rgba(27,42,74,0.04)', border: '1px solid rgba(27,42,74,0.10)' }}>
                <label style={labelStyle}>{t('template_name_label')}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="e.g. Shift reminder, HIPAA notice…"
                    autoFocus
                    style={fieldStyle}
                  />
                  <button
                    onClick={() => {
                      setTemplateError(null)
                      startTemplateTransition(async () => {
                        try {
                          await saveTemplate({ name: templateName, subject: subject, body: body, channel })
                          setSavingTemplate(false)
                        } catch (e) {
                          setTemplateError(e instanceof Error ? e.message : 'Failed to save')
                        }
                      })
                    }}
                    disabled={isPendingTemplate || !templateName.trim()}
                    style={{
                      padding: '9px 16px', borderRadius: '8px', border: 'none',
                      background: 'var(--navy)', color: 'white',
                      fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'inherit', whiteSpace: 'nowrap',
                      opacity: isPendingTemplate ? 0.7 : 1,
                    }}
                  >{isPendingTemplate ? t('saving') : t('save_label')}</button>
                  <button
                    onClick={() => setSavingTemplate(false)}
                    style={{
                      padding: '9px 12px', borderRadius: '8px',
                      border: '1px solid var(--surface-border)',
                      background: 'transparent', color: 'var(--text-secondary)',
                      fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >{t('cancel')}</button>
                </div>
                {templateError && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>{templateError}</p>}
              </div>
            )}
          </div>
        )}

        {view === 'detail' && selectedMsg && (
          <MessageDetail msg={selectedMsg} onBack={() => setMobilePanel('list')} />
        )}

        {view === 'detail' && !selectedMsg && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-faint)' }}>
            <Inbox style={{ width: '32px', height: '32px' }} />
            <p style={{ fontSize: '14px', fontWeight: 500 }}>{t('select_message_view')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Message Detail ────────────────────────────────────────────────────────────

function MessageDetail({ msg, onBack }: { msg: MessageWithRecipients; onBack: () => void }) {
  const t = useAdminT()
  const ch = CHANNEL_CONFIG[msg.channel as MessageChannel]
  const deliveryPct = msg.recipient_count > 0
    ? Math.round((msg.delivered_count / msg.recipient_count) * 100) : 0
  const readPct = msg.recipient_count > 0
    ? Math.round((msg.read_count / msg.recipient_count) * 100) : 0

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

      {/* Mobile back button */}
      <button
        className="msg-back-btn"
        onClick={onBack}
        style={{ display: 'none' /* shown by CSS on mobile */ }}
      >
        <ChevronLeft style={{ width: '14px', height: '14px' }} />
        {t('messages_title')}
      </button>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
          <h2 style={{
            fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)', letterSpacing: '-0.025em', lineHeight: 1.3,
          }}>
            {msg.subject || '(No subject)'}
          </h2>
          <span style={{
            padding: '3px 10px', borderRadius: '99px',
            fontSize: '11px', fontWeight: 700,
            background: ch.color + '18', color: ch.color,
            flexShrink: 0, letterSpacing: '0.02em',
          }}>{ch.icon} {ch.label}</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {t('sent_prefix')} {formatDate(msg.sent_at ?? msg.created_at ?? '')}
          {' · '}{msg.recipient_type === 'all' ? t('all_volunteers') : msg.recipient_type}
        </p>
      </div>

      {/* Stats */}
      <div className="msg-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {[
          { label: t('recipients_stat'), value: String(msg.recipient_count),           icon: <Users style={{ width: '14px', height: '14px' }} />,     color: 'var(--text-secondary)' },
          { label: t('delivered_stat'),  value: `${msg.delivered_count} (${deliveryPct}%)`, icon: <CheckCheck style={{ width: '14px', height: '14px' }} />, color: '#10b981' },
          { label: t('read_stat'),       value: `${msg.read_count} (${readPct}%)`,      icon: <Eye style={{ width: '14px', height: '14px' }} />,        color: '#3b82f6' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '14px 16px', borderRadius: '10px',
            background: 'var(--surface-bg)', border: '1px solid var(--surface-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: stat.color, marginBottom: '6px' }}>
              {stat.icon}
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{stat.label}</span>
            </div>
            <p style={{ fontSize: '20px', fontWeight: 800, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Message body */}
      <div style={{ marginBottom: '6px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
          {t('message_body_label')}
        </p>
        <div style={{
          padding: '18px 20px', background: 'var(--surface-bg)',
          borderRadius: '10px', border: '1px solid var(--surface-border)',
          fontSize: '14px', lineHeight: '1.7', color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
        }}>
          {msg.body}
        </div>
      </div>
    </div>
  )
}

// ─── Style atoms ───────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  borderRadius: '8px', border: '1px solid var(--surface-border)',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  color: 'var(--text-primary)', background: 'var(--surface-card)',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: 700,
  color: 'var(--text-faint)', marginBottom: '7px',
  textTransform: 'uppercase', letterSpacing: '0.08em',
}
