import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only admins may initiate background checks. verify_jwt accepts the
    // public anon key, so the caller's identity must be checked explicitly.
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!adminRow) return json({ error: 'Admin access required' }, 403)

    const { volunteer_id } = await req.json()

    if (!volunteer_id) {
      return json({ error: 'volunteer_id is required' }, 400)
    }

    const CHECKR_API_KEY = Deno.env.get('CHECKR_API_KEY')

    // Stub mode if no API key
    if (!CHECKR_API_KEY) {
      const { data, error } = await supabase
        .from('background_checks')
        .insert({
          volunteer_id,
          provider: 'checkr',
          external_id: `stub_${Date.now()}`,
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error

      return json({ success: true, stub: true, background_check: data })
    }

    // TODO: Real Checkr API call when key is configured
    // POST https://api.checkr.com/v1/candidates + POST /v1/invitations
    return json({ error: 'Checkr integration not yet configured' }, 501)
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})
