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

    const { volunteer_id } = await req.json()

    if (!volunteer_id) {
      return new Response(
        JSON.stringify({ error: 'volunteer_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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

      return new Response(
        JSON.stringify({ success: true, stub: true, background_check: data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // TODO: Real Checkr API call when key is configured
    // POST https://api.checkr.com/v1/candidates + POST /v1/invitations
    return new Response(
      JSON.stringify({ error: 'Checkr integration not yet configured' }),
      { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
