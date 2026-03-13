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

    const { volunteer_id, location_id, shift_id, method = 'manual' } = await req.json()

    if (!volunteer_id || !location_id) {
      return new Response(
        JSON.stringify({ error: 'volunteer_id and location_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for existing open time entry
    const { data: existing } = await supabase
      .from('time_entries')
      .select('id')
      .eq('volunteer_id', volunteer_id)
      .is('clock_out', null)
      .single()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Already clocked in', time_entry_id: existing.id }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create time entry
    const { data: entry, error } = await supabase
      .from('time_entries')
      .insert({
        volunteer_id,
        location_id,
        shift_id: shift_id || null,
        method,
        clock_in: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

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
