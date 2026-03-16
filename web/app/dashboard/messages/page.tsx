import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import MessagesView from './MessagesView'
import type { Message, MessageRecipient, Volunteer } from '@/types/database'

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
      .in('status', ['active', 'onboarding'])
      .order('first_name', { ascending: true }),
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

  return { messages: msgWithStats, volunteers: volList }
}

export default async function MessagesPage() {
  const { messages, volunteers } = await fetchData()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '28px 32px 20px',
        borderBottom: '1px solid #f0f0f0',
        background: 'white',
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
          Messages
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>
          Send emails, SMS, and push notifications to volunteers
        </p>
      </div>

      <MessagesView initialMessages={messages} volunteers={volunteers} />
    </div>
  )
}
