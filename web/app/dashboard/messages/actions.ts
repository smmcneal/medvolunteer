'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function saveTemplate(input: { name: string; subject: string; body: string; channel: string }) {
  if (!input.name.trim()) throw new Error('Template name is required')
  const supabase = createAdminClient()
  const { data: org } = await supabase.from('organizations').select('id').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { error } = await supabase.from('message_templates').insert({
    org_id: org.id,
    name: input.name.trim(),
    subject: input.subject.trim(),
    body: input.body.trim(),
    channel: input.channel,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/messages')
}

export async function deleteTemplate(templateId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('message_templates').delete().eq('id', templateId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/messages')
}

export async function sendMessage(data: {
  subject: string
  body: string
  channel: 'email' | 'sms' | 'push'
  recipient_type: 'individual' | 'group' | 'all'
  recipient_volunteer_ids: string[]
  scheduled_send_at?: string | null
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single()
  if (!org) throw new Error('No organization found')

  const isScheduled = !!data.scheduled_send_at

  // Insert the message
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      org_id: org.id,
      sender_id: user.id,
      subject: data.subject,
      body: data.body,
      channel: data.channel,
      recipient_type: data.recipient_type,
      sent_at: isScheduled ? null : new Date().toISOString(),
      scheduled_send_at: isScheduled ? data.scheduled_send_at : null,
      status: isScheduled ? 'scheduled' : 'sent',
    })
    .select('id')
    .single()

  if (msgErr || !message) throw new Error(msgErr?.message ?? 'Failed to create message')

  // Insert recipient rows
  if (data.recipient_volunteer_ids.length > 0) {
    const { error: recErr } = await supabase.from('message_recipients').insert(
      data.recipient_volunteer_ids.map(vid => ({
        message_id: message.id,
        volunteer_id: vid,
      }))
    )
    if (recErr) throw new Error(recErr.message)
  }

  revalidatePath('/dashboard/messages')
}
