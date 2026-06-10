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

    // Only admins (or service-role callers) may advance onboarding stages.
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

    const { volunteer_id, stage_id, completed_by, notes, metadata } = await req.json()

    if (!volunteer_id || !stage_id) {
      return new Response(
        JSON.stringify({ error: 'volunteer_id and stage_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Upsert progress record
    const { error: progressError } = await supabase
      .from('onboarding_progress')
      .upsert({
        volunteer_id,
        stage_id,
        completed_at: new Date().toISOString(),
        completed_by: completed_by || null,
        notes: notes || null,
        metadata: metadata || {},
      }, { onConflict: 'volunteer_id,stage_id' })

    if (progressError) throw progressError

    // Get the volunteer's workflow to check if all required stages are done
    const { data: volunteer } = await supabase
      .from('volunteers')
      .select('onboarding_workflow_id, status')
      .eq('id', volunteer_id)
      .single()

    if (volunteer?.onboarding_workflow_id) {
      const { data: requiredStages } = await supabase
        .from('onboarding_stages')
        .select('id')
        .eq('workflow_id', volunteer.onboarding_workflow_id)
        .eq('is_required', true)

      const { data: completedProgress } = await supabase
        .from('onboarding_progress')
        .select('stage_id')
        .eq('volunteer_id', volunteer_id)
        .not('completed_at', 'is', null)

      const completedIds = new Set(completedProgress?.map(p => p.stage_id) || [])
      const allDone = requiredStages?.every(s => completedIds.has(s.id))

      // If all required stages complete, activate the volunteer.
      // (Status enum was renamed in 20260314: onboarding→prospect, active→volunteer.)
      if (allDone && volunteer.status === 'prospect') {
        await supabase
          .from('volunteers')
          .update({ status: 'volunteer' })
          .eq('id', volunteer_id)
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
