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
    // Identify the caller from their JWT — the volunteer is derived from the
    // session, never trusted from the request body. (verify_jwt accepts the
    // public anon key, so the body-supplied volunteer_id of the old version
    // let anyone forge time entries.)
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

    const { data: volunteer } = await supabase
      .from('volunteers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!volunteer) return json({ error: 'Volunteer not found' }, 404)

    const { location_id, shift_id, method = 'manual' } = await req.json()

    if (!location_id) {
      return json({ error: 'location_id is required' }, 400)
    }

    // Check for existing open time entry
    const { data: existing } = await supabase
      .from('time_entries')
      .select('id')
      .eq('volunteer_id', volunteer.id)
      .is('clock_out', null)
      .maybeSingle()

    if (existing) {
      return json({ error: 'Already clocked in', time_entry_id: existing.id }, 409)
    }

    // Create time entry
    const { data: entry, error } = await supabase
      .from('time_entries')
      .insert({
        volunteer_id: volunteer.id,
        location_id,
        shift_id: shift_id || null,
        method,
        clock_in: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return json({ success: true, time_entry: entry })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})
