import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Only admins (or service-role callers) may trigger message dispatch —
    // verify_jwt accepts the public anon key, so check the caller explicitly.
    const authHeader = req.headers.get('Authorization') ?? ''
    const isServiceRole = authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    if (!isServiceRole) {
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user } } = await authClient.auth.getUser()
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!adminRow) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { message_id } = await req.json()

    if (!message_id) {
      return new Response(
        JSON.stringify({ error: 'message_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch message and recipients
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('*, message_recipients(*, volunteers(email, phone, first_name, last_name))')
      .eq('id', message_id)
      .single()

    if (msgError || !message) throw new Error('Message not found')

    const results = { sent: 0, failed: 0, errors: [] as string[] }

    for (const recipient of message.message_recipients || []) {
      const volunteer = recipient.volunteers
      if (!volunteer) continue

      try {
        if (message.channel === 'email') {
          await sendEmail({
            to: volunteer.email,
            subject: message.subject || '(No Subject)',
            body: message.body,
            name: `${volunteer.first_name} ${volunteer.last_name}`,
          })
        } else if (message.channel === 'sms') {
          await sendSms({
            to: volunteer.phone,
            body: message.body,
          })
        } else if (message.channel === 'push') {
          await sendPush({
            supabase,
            volunteer_id: recipient.volunteer_id,
            title: message.subject || 'MedVolunteer',
            body: message.body,
          })
        }

        // Mark as delivered
        await supabase
          .from('message_recipients')
          .update({ delivered_at: new Date().toISOString() })
          .eq('id', recipient.id)

        results.sent++
      } catch (e) {
        results.failed++
        results.errors.push(`${volunteer.email}: ${e.message}`)
      }
    }

    // Update message status
    await supabase
      .from('messages')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', message_id)

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sendEmail({ to, subject, body, name }: {
  to: string; subject: string; body: string; name: string
}) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) {
    console.log(`[STUB] Email to ${to}: ${subject}`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MedVolunteer <noreply@yourdomain.com>',
      to: [to],
      subject,
      html: `<p>Hi ${name},</p><p>${body}</p>`,
    }),
  })
  if (!res.ok) throw new Error(`Resend error: ${await res.text()}`)
}

async function sendSms({ to, body }: { to: string; body: string }) {
  const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
  const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
  const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER')
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log(`[STUB] SMS to ${to}: ${body}`)
    return
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
    }
  )
  if (!res.ok) throw new Error(`Twilio error: ${await res.text()}`)
}

// Stub: real VAPID implementation lives in the send-push edge function (Phase 8).
// Here we delegate to it so the push channel is wired end-to-end when that
// function is deployed.
async function sendPush({ supabase, volunteer_id, title, body }: {
  supabase: ReturnType<typeof createClient>
  volunteer_id: string
  title: string
  body: string
}) {
  const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
  if (!VAPID_PUBLIC_KEY) {
    console.log(`[STUB] Push to volunteer ${volunteer_id}: ${title}`)
    return
  }
  // Fetch all subscriptions for this volunteer and dispatch via send-push function
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('volunteer_id', volunteer_id)

  if (!subs || subs.length === 0) return

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ volunteer_id, title, body }),
  })
}
