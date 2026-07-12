import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, renderTemplate } from '@/lib/email'

// Vercel Cron: daily at midnight UTC (Hobby plan only allows daily cron jobs —
// downgraded from hourly 2026-07-11 after discovering this cron schedule had been
// silently blocking every production deployment since ~2026-04-29).
// vercel.json → { "path": "/api/cron/send-auto-messages", "schedule": "0 0 * * *" }
//
// Consequence: "Send Later" scheduled messages (status='scheduled', scheduled_send_at
// in the past) now only get dispatched once a day at this run, not near-real-time.
// A message scheduled for e.g. 2pm UTC won't actually send until the next midnight
// UTC run — up to a ~24h delay. isDailyRun below is now always true since this is
// the only run of the day; the check is left in place in case the schedule is ever
// upgraded back to hourly (e.g. after moving to Vercel Pro).

export async function GET(request: Request) {
  // Fail closed: without a configured secret, "Bearer undefined" must not pass.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return new NextResponse('CRON_SECRET not configured', { status: 500 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // ?mode=scheduled → dispatch "Send Later" messages ONLY; never run the daily
  // auto-message rules. Safe to call at any frequency: the scheduled-message pass
  // is idempotent (rows flip to status='sent' and the query only picks up
  // status='scheduled'). This is what `.github/workflows/cron-scheduled-messages.yml`
  // calls every 30 minutes, because Vercel Hobby cron is capped at once a day.
  //
  // No mode (Vercel's own midnight cron) → unchanged behavior: daily rules + scheduled.
  // The daily rules are NOT idempotent — they are gated solely by the UTC-hour check
  // below, so they must never run on the frequent invocation.
  const mode = new URL(request.url).searchParams.get('mode')
  const scheduledOnly = mode === 'scheduled'

  const supabase = createAdminClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch the single org
  const { data: org } = await supabase.from('organizations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ ok: false, error: 'No org found' }, { status: 500 })

  // The daily reminder rules must fire exactly once per day — on the midnight UTC
  // run — or volunteers get the same reminder repeatedly. Two guards, both required:
  //   scheduledOnly  — the every-30-min GitHub Actions call must never run rules
  //                    (the 00:00 and 00:30 invocations both fall in UTC hour 0).
  //   getUTCHours()  — belt and braces if the Vercel schedule is ever made hourly.
  const isDailyRun = !scheduledOnly && new Date().getUTCHours() === 0

  const { data: rules, error } = isDailyRun
    ? await supabase
        .from('auto_message_rules')
        .select('*, message_templates(name, subject, body, channel)')
        .eq('org_id', org.id)
        .eq('is_active', true)
    : { data: [], error: null }

  if (error) {
    console.error('[cron] failed to fetch rules:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const sent: string[] = []
  const failures: string[] = []

  async function dispatch(to: string, subject: string, body: string, vars: Record<string, string | null | undefined>, label: string) {
    const result = await sendEmail({
      to,
      subject: renderTemplate(subject, vars),
      body: renderTemplate(body, vars),
    })
    if (result.ok) {
      sent.push(`${label} → ${to}`)
    } else {
      failures.push(`${label} → ${to}: ${result.error}`)
    }
    return result
  }

  for (const rule of rules ?? []) {
    const template = rule.message_templates as { name: string; subject: string; body: string; channel: string } | null
    if (!template) continue

    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + rule.days_before)
    const targetDateStr = targetDate.toISOString().split('T')[0]

    if (rule.trigger_type === 'shift_reminder') {
      const { data: shifts } = await supabase
        .from('shifts')
        .select('id, name, start_time, shift_assignments(volunteer_id, status, volunteers(email, first_name, last_name))')
        .eq('org_id', org.id)
        .gte('start_time', `${targetDateStr}T00:00:00`)
        .lt('start_time', `${targetDateStr}T23:59:59.999`)

      type ReminderAssignment = {
        status: string
        volunteers: { email: string | null; first_name: string; last_name: string } | null
      }

      for (const shift of shifts ?? []) {
        const assignments = ((shift as unknown as { shift_assignments?: ReminderAssignment[] }).shift_assignments) ?? []
        for (const assignment of assignments) {
          // Soft-deleted assignments must not get reminders
          if (assignment.status === 'cancelled') continue
          const vol = assignment.volunteers
          if (!vol?.email) continue
          await dispatch(vol.email, template.subject, template.body, {
            first_name: vol.first_name,
            last_name: vol.last_name,
            shift_name: shift.name,
            shift_date: new Date(shift.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
          }, `shift_reminder (${shift.name})`)
        }
      }
    } else if (rule.trigger_type === 'cert_expiry') {
      const { data: creds } = await supabase
        .from('credentials')
        .select('id, type, expiration_date, volunteer_id, volunteers(email, first_name, last_name, org_id)')
        .eq('expiration_date', targetDateStr)

      for (const cred of creds ?? []) {
        const vol = (cred as unknown as {
          volunteers: { email: string | null; first_name: string; last_name: string; org_id: string } | null
        }).volunteers
        if (!vol?.email || vol.org_id !== org.id) continue
        await dispatch(vol.email, template.subject, template.body, {
          first_name: vol.first_name,
          last_name: vol.last_name,
          credential_type: cred.type,
          expiration_date: cred.expiration_date,
        }, `cert_expiry (${cred.type})`)
      }
    } else if (rule.trigger_type === 'open_shift') {
      const { data: shifts } = await supabase
        .from('shifts')
        .select('id, name, required_count, shift_assignments(id, status)')
        .eq('org_id', org.id)
        .gte('start_time', `${targetDateStr}T00:00:00`)
        .lt('start_time', `${targetDateStr}T23:59:59.999`)

      const openShifts = (shifts ?? []).filter(s => {
        const row = s as { shift_assignments?: { status: string }[]; required_count: number }
        // Count only active assignments — cancelled rows don't fill a slot
        const filled = (row.shift_assignments ?? [])
          .filter(a => a.status !== 'cancelled').length
        return filled < row.required_count
      })

      if (openShifts.length > 0) {
        const { data: volunteers } = await supabase
          .from('volunteers')
          .select('email, first_name, last_name')
          .eq('org_id', org.id)
          .eq('status', 'volunteer')

        for (const vol of volunteers ?? []) {
          if (!vol.email) continue
          await dispatch(vol.email, template.subject, template.body, {
            first_name: vol.first_name,
            last_name: vol.last_name,
          }, 'open_shift')
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
      // SMS/push aren't wired yet — these exist as in-app inbox items only.
      await supabase.from('messages').update({ status: 'sent', sent_at: now }).eq('id', msg.id)
      sent.push(`scheduled → ${msg.channel} (${msg.id})`)
      continue
    }

    const { data: recipients } = await supabase
      .from('message_recipients')
      .select('id, volunteer_id, volunteers(email, first_name, last_name)')
      .eq('message_id', msg.id)

    let anyAttempted = false
    let allNotConfigured = true

    type RecipientRow = {
      id: string
      volunteers: { email: string | null; first_name: string; last_name: string } | null
    }

    for (const rec of (recipients ?? []) as unknown as RecipientRow[]) {
      const vol = rec.volunteers
      if (!vol?.email) continue
      anyAttempted = true
      const result = await dispatch(vol.email, msg.subject ?? '(no subject)', msg.body, {
        first_name: vol.first_name,
        last_name: vol.last_name,
      }, `scheduled (${msg.id})`)
      if (result.ok) {
        allNotConfigured = false
        await supabase
          .from('message_recipients')
          .update({ delivered_at: now })
          .eq('id', rec.id)
      } else if (!result.notConfigured) {
        allNotConfigured = false
      }
    }

    // If Resend isn't configured at all, leave the message scheduled so it
    // is retried once the key is in place, instead of lying with 'sent'.
    if (anyAttempted && allNotConfigured) continue

    await supabase
      .from('messages')
      .update({ status: 'sent', sent_at: now })
      .eq('id', msg.id)
  }

  if (failures.length > 0) {
    console.error('[cron] delivery failures:', failures)
  }

  return NextResponse.json({ ok: true, sent: sent.length, failed: failures.length, details: sent, failures })
}
