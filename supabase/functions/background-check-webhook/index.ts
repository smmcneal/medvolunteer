import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Checkr webhook receiver.
//
// verify_jwt is disabled for this function (supabase/config.toml) because
// Checkr cannot send a Supabase JWT — with verify_jwt on, every real webhook
// was rejected. Authenticity is verified with Checkr's HMAC signature
// instead: X-Checkr-Signature = hex(HMAC-SHA256(body, CHECKR_WEBHOOK_SECRET)).
// Set CHECKR_WEBHOOK_SECRET in the function's env when wiring Checkr.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-checkr-signature',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text()

    const secret = Deno.env.get('CHECKR_WEBHOOK_SECRET')
    if (!secret) {
      // Fail closed: without a configured secret anyone could forge results.
      return json({ error: 'CHECKR_WEBHOOK_SECRET not configured' }, 500)
    }

    const signature = req.headers.get('x-checkr-signature')
    if (!signature) return json({ error: 'Missing signature' }, 401)

    const expected = await hmacHex(secret, rawBody)
    if (signature !== expected) return json({ error: 'Invalid signature' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const payload = JSON.parse(rawBody)

    // Checkr sends: { type: 'report.completed', data: { object: { id, status, result } } }
    const { type, data } = payload

    if (type === 'report.completed') {
      const report = data?.object
      const { error } = await supabase
        .from('background_checks')
        .update({
          status: report.status,
          result: report.adjudication || 'pending',
          report_url: report.uri,
          completed_at: new Date().toISOString(),
        })
        .eq('external_id', report.id)

      if (error) throw error
    }

    return json({ received: true })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})
