import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel Cron: daily midnight UTC
// vercel.json → { "path": "/api/cron/send-auto-messages", "schedule": "0 0 * * *" }

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch the single org
  const { data: org } = await supabase.from('organizations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ ok: false, error: 'No org found' }, { status: 500 })

  const { data: rules, error } = await supabase
    .from('auto_message_rules')
    .select('*, message_templates(name, subject, body, channel)')
    .eq('org_id', org.id)
    .eq('is_active', true)

  if (error) {
    console.error('[cron] failed to fetch rules:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const sent: string[] = []

  for (const rule of rules ?? []) {
    const template = rule.message_templates as { name: string; subject: string; body: string; channel: string } | null
    if (!template) continue

    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + rule.days_before)
    const targetDateStr = targetDate.toISOString().split('T')[0]

    if (rule.trigger_type === 'shift_reminder') {
      const { data: shifts } = await supabase
        .from('shifts')
        .select('id, name, start_time, shift_assignments(volunteer_id, volunteers(email, first_name))')
        .eq('org_id', org.id)
        .gte('start_time', `${targetDateStr}T00:00:00`)
        .lt('start_time', `${targetDateStr}T23:59:59`)

      for (const shift of shifts ?? []) {
        const assignments = (shift as any).shift_assignments ?? []
        for (const assignment of assignments) {
          const vol = assignment.volunteers
          if (!vol?.email) continue
          await sendEmail({ to: vol.email, subject: template.subject, body: template.body })
          sent.push(`shift_reminder → ${vol.email} (${shift.name})`)
        }
      }
    } else if (rule.trigger_type === 'cert_expiry') {
      const { data: creds } = await supabase
        .from('credentials')
        .select('id, type, expiration_date, volunteer_id, volunteers(email, first_name, org_id)')
        .eq('expiration_date', targetDateStr)

      for (const cred of creds ?? []) {
        const vol = (cred as any).volunteers
        if (!vol?.email || vol.org_id !== org.id) continue
        await sendEmail({ to: vol.email, subject: template.subject, body: template.body })
        sent.push(`cert_expiry → ${vol.email} (${cred.type})`)
      }
    } else if (rule.trigger_type === 'open_shift') {
      const { data: shifts } = await supabase
        .from('shifts')
        .select('id, name, required_count, shift_assignments(id)')
        .eq('org_id', org.id)
        .gte('start_time', `${targetDateStr}T00:00:00`)
        .lt('start_time', `${targetDateStr}T23:59:59`)

      const openShifts = (shifts ?? []).filter(s => {
        const filled = ((s as any).shift_assignments ?? []).length
        return filled < (s as any).required_count
      })

      if (openShifts.length > 0) {
        const { data: volunteers } = await supabase
          .from('volunteers')
          .select('email, first_name')
          .eq('org_id', org.id)
          .eq('status', 'volunteer')

        for (const vol of volunteers ?? []) {
          if (!vol.email) continue
          await sendEmail({ to: vol.email, subject: template.subject, body: template.body })
          sent.push(`open_shift → ${vol.email}`)
        }
      }
    }
  }

  // ── Dispatch scheduled messages ────────────────────────────────
  const now = new Date().toISOString()
  const { data: scheduledMsgs } = await supabase
    .from('messages')
    .select('id, subject, body, channel')
    .eq('status', 'scheduled')
    .lte('scheduled_send_at', now)

  for (const msg of scheduledMsgs ?? []) {
    if (msg.channel !== 'email') {
      // Mark non-email channels as sent (SMS/push not yet wired)
      await supabase.from('messages').update({ status: 'sent', sent_at: now }).eq('id', msg.id)
      sent.push(`scheduled → ${msg.channel} (${msg.id})`)
      continue
    }

    const { data: recipients } = await supabase
      .from('message_recipients')
      .select('volunteer_id, volunteers(email)')
      .eq('message_id', msg.id)

    for (const rec of recipients ?? []) {
      const email = (rec as any).volunteers?.email
      if (!email) continue
      await sendEmail({ to: email, subject: msg.subject ?? '(no subject)', body: msg.body })
      sent.push(`scheduled → ${email}`)
    }

    await supabase
      .from('messages')
      .update({ status: 'sent', sent_at: now })
      .eq('id', msg.id)
  }

  return NextResponse.json({ ok: true, sent: sent.length, details: sent })
}

async function sendEmail({ to, subject, body }: { to: string; subject: string; body: string }) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@yakimaclinic.org',
      to,
      subject,
      text: body,
    }),
  })
}
