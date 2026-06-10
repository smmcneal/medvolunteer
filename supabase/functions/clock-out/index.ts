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
    // The volunteer is derived from the caller's JWT, never from the body.
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

    const { time_entry_id, notes } = await req.json()

    // Find open entry — use provided ID or find the open one
    let query = supabase
      .from('time_entries')
      .update({ clock_out: new Date().toISOString(), notes })
      .eq('volunteer_id', volunteer.id)
      .is('clock_out', null)
      .select()
      .single()

    if (time_entry_id) {
      query = supabase
        .from('time_entries')
        .update({ clock_out: new Date().toISOString(), notes })
        .eq('id', time_entry_id)
        .eq('volunteer_id', volunteer.id)
        .is('clock_out', null)
        .select()
        .single()
    }

    const { data: entry, error } = await query

    if (error || !entry) {
      return json({ error: 'No open time entry found' }, 404)
    }

    return json({ success: true, time_entry: entry })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})
