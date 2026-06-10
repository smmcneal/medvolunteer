'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { sendEmail, renderTemplate } from '@/lib/email'
import { revalidatePath } from 'next/cache'

export async function saveTemplate(input: { name: string; subject: string; body: string; channel: string }) {
  await requireAdmin()
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
  await requireAdmin()
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
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single()
  if (!org) throw new Error('No organization found')

  const isScheduled = !!data.scheduled_send_at

  // Insert the message. sender_id references auth.users — admins have no
  // volunteers row, so the FK was repointed in the 20260609 RLS migration.
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      org_id: org.id,
      sender_id: user.id,
      subject: data.subject,
      body: data.body,
      channel: data.channel,
      recipient_type: data.recipient_type,
      sent_at: null,
      scheduled_send_at: isScheduled ? data.scheduled_send_at : null,
      status: isScheduled ? 'scheduled' : 'draft',
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

  // Scheduled messages are dispatched by the cron route at the scheduled time.
  if (isScheduled) {
    revalidatePath('/dashboard/messages')
    return
  }

  // Immediate dispatch. Email goes out via Resend; sms/push channels are not
  // wired yet, so those messages exist as in-app inbox items only.
  if (data.channel === 'email' && data.recipient_volunteer_ids.length > 0) {
    const { data: recipients } = await supabase
      .from('volunteers')
      .select('id, email, first_name, last_name')
      .in('id', data.recipient_volunteer_ids)

    const failures: string[] = []
    let attempted = 0
    let notConfigured = false

    for (const vol of recipients ?? []) {
      if (!vol.email) continue
      attempted++
      const result = await sendEmail({
        to: vol.email,
        subject: data.subject || '(no subject)',
        body: renderTemplate(data.body, {
          first_name: vol.first_name,
          last_name: vol.last_name,
        }),
      })
      if (result.ok) {
        await supabase
          .from('message_recipients')
          .update({ delivered_at: new Date().toISOString() })
          .eq('message_id', message.id)
          .eq('volunteer_id', vol.id)
      } else if (result.notConfigured) {
        // No Resend key (local dev): in-app delivery still works, don't block.
        notConfigured = true
        break
      } else {
        failures.push(`${vol.email}: ${result.error}`)
      }
    }

    if (!notConfigured && attempted > 0 && failures.length === attempted) {
      await supabase.from('messages').update({ status: 'failed' }).eq('id', message.id)
      revalidatePath('/dashboard/messages')
      throw new Error(`Email delivery failed: ${failures[0]}`)
    }
    if (failures.length > 0) {
      console.error('[sendMessage] partial delivery failures:', failures)
    }
  }

  await supabase
    .from('messages')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', message.id)

  revalidatePath('/dashboard/messages')
}
