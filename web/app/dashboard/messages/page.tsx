import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import MessagesView from './MessagesView'
import type { Message, Volunteer, MessageTemplate, Category } from '@/types/database'

export const dynamic = 'force-dynamic'

export interface MessageWithRecipients extends Message {
  recipient_count: number
  delivered_count: number
  read_count: number
}

async function fetchData() {
  noStore()
  const supabase = createAdminClient()

  const [
    { data: messages },
    { data: recipients },
    { data: volunteers },
    { data: templates },
    { data: categoriesData },
  ] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100),
    supabase
      .from('message_recipients')
      .select('*'),
    supabase
      .from('volunteers')
      .select('id, first_name, last_name, email, phone, category, status')
      .in('status', ['volunteer', 'prospect'])
      .order('first_name', { ascending: true }),
    supabase
      .from('message_templates')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('categories').select('*').eq('is_archived', false).order('sort_order'),
  ])

  const msgList = messages ?? []
  const recList = recipients ?? []
  const volList = volunteers ?? []

  const msgWithStats: MessageWithRecipients[] = msgList.map(msg => {
    const recs = recList.filter(r => r.message_id === msg.id)
    return {
      ...msg,
      recipient_count: recs.length,
      delivered_count: recs.filter(r => r.delivered_at !== null).length,
      read_count: recs.filter(r => r.read_at !== null).length,
    }
  })

  return { messages: msgWithStats, volunteers: volList, templates: (templates ?? []) as MessageTemplate[], categories: (categoriesData ?? []) as Category[] }
}

export default async function MessagesPage() {
  const { messages, volunteers, templates, categories } = await fetchData()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        className="dash-page-header"
        style={{
          padding: '18px 28px',
          borderBottom: '1px solid var(--surface-border)',
          background: 'var(--surface-card)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: '10px',
        }}
      >
        <h1 style={{
          fontSize: '22px', fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)',
          letterSpacing: '-0.025em', lineHeight: 1,
        }}>
          Messages
        </h1>
        <span style={{
          fontSize: '12px', fontWeight: 600,
          padding: '3px 9px', borderRadius: '99px',
          background: 'rgba(0, 137, 123, 0.1)',
          color: 'var(--teal)',
          border: '1px solid rgba(0, 172, 193, 0.18)',
          letterSpacing: '0.01em',
        }}>
          {messages.length}
        </span>
      </div>

      <MessagesView initialMessages={messages} volunteers={volunteers} templates={templates} categories={categories} />
    </div>
  )
}
