import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MessagesView from './MessagesView'

export type InboxItem = {
  recipientId: string
  messageId: string
  subject: string | null
  body: string
  channel: string
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
}

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/volunteer/login')

  const { data: volunteer } = await supabase
    .from('volunteers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) redirect('/volunteer/login')

  // Fetch message_recipients with message details, ordered newest first
  const { data: recipients } = await supabase
    .from('message_recipients')
    .select(`
      id,
      delivered_at,
      read_at,
      messages(id, subject, body, channel, sent_at)
    `)
    .eq('volunteer_id', volunteer.id)
    .order('id', { ascending: false })

  // Mark any undelivered messages as delivered
  const undelivered = (recipients ?? []).filter(r => !r.delivered_at)
  if (undelivered.length > 0) {
    await supabase
      .from('message_recipients')
      .update({ delivered_at: new Date().toISOString() })
      .in('id', undelivered.map(r => r.id))
  }

  const inbox: InboxItem[] = (recipients ?? [])
    .map(r => {
      const msg = r.messages as {
        id: string
        subject: string | null
        body: string
        channel: string
        sent_at: string | null
      } | null
      if (!msg) return null
      return {
        recipientId: r.id,
        messageId: msg.id,
        subject: msg.subject,
        body: msg.body,
        channel: msg.channel,
        sentAt: msg.sent_at,
        deliveredAt: r.delivered_at,
        readAt: r.read_at,
      }
    })
    .filter((x): x is InboxItem => x !== null)
    // Sort newest sent first; fall back to delivery order
    .sort((a, b) => {
      const ta = a.sentAt ? new Date(a.sentAt).getTime() : 0
      const tb = b.sentAt ? new Date(b.sentAt).getTime() : 0
      return tb - ta
    })

  const unreadCount = inbox.filter(m => !m.readAt).length

  return <MessagesView inbox={inbox} unreadCount={unreadCount} />
}
