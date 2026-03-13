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

    const { volunteer_id, time_entry_id, notes } = await req.json()

    if (!volunteer_id) {
      return new Response(
        JSON.stringify({ error: 'volunteer_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find open entry — use provided ID or find the open one
    let query = supabase
      .from('time_entries')
      .update({ clock_out: new Date().toISOString(), notes })
      .eq('volunteer_id', volunteer_id)
      .is('clock_out', null)
      .select()
      .single()

    if (time_entry_id) {
      query = supabase
        .from('time_entries')
        .update({ clock_out: new Date().toISOString(), notes })
        .eq('id', time_entry_id)
        .eq('volunteer_id', volunteer_id)
        .select()
        .single()
    }

    const { data: entry, error } = await query

    if (error || !entry) {
      return new Response(
        JSON.stringify({ error: 'No open time entry found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, time_entry: entry }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
