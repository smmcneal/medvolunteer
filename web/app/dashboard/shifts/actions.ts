'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function createShift(data: {
  name: string
  location_id: string | null
  start_time: string
  end_time: string
  required_count: number
  notes: string
  volunteer_ids?: string[]
}): Promise<{ shiftId: string }> {
  // Use admin client so org lookup is never blocked by RLS
  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .limit(1)
    .single()

  if (!org) throw new Error('No organization found')

  const { volunteer_ids, ...shiftData } = data

  const { data: shift, error } = await admin
    .from('shifts')
    .insert({ org_id: org.id, ...shiftData })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // Bulk-assign selected volunteers (skip training-phase — they need mentor pairing via the roster panel)
  if (volunteer_ids && volunteer_ids.length > 0) {
    const { data: vols } = await admin
      .from('volunteers')
      .select('id, pipeline_phase')
      .in('id', volunteer_ids)

    const assignable = (vols ?? []).filter(v => v.pipeline_phase !== 'training')
    if (assignable.length > 0) {
      await admin.from('shift_assignments').insert(
        assignable.map(v => ({
          shift_id: shift.id,
          volunteer_id: v.id,
          status: 'assigned',
          role: null,
          mentor_id: null,
        }))
      )
    }
  }

  revalidatePath('/dashboard/shifts')
  revalidatePath('/volunteer/shifts')
  return { shiftId: shift.id }
}

export async function updateShift(id: string, data: {
  name?: string
  location_id?: string | null
  start_time?: string
  end_time?: string
  required_count?: number
  notes?: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('shifts').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
}

export async function deleteShift(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('shifts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export async function assignVolunteer(
  shift_id: string,
  volunteer_id: string,
  role = '',
  mentor_id?: string,
) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // Enforce mentor requirement for training-phase volunteers
  const { data: vol } = await admin
    .from('volunteers')
    .select('pipeline_phase')
    .eq('id', volunteer_id)
    .single()

  if (vol?.pipeline_phase === 'training' && !mentor_id) {
    throw new Error('Mentor required for training-phase volunteers')
  }

  const { error } = await supabase.from('shift_assignments').insert({
    shift_id,
    volunteer_id,
    role: role || null,
    status: 'assigned',
    mentor_id: mentor_id ?? null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
  revalidatePath('/volunteer/shifts')
}

export async function assignTraineeWithMentor(
  shift_id: string,
  trainee_id: string,
  mentor_id: string,
  role = '',
) {
  const supabase = await createClient()

  // Ensure mentor is already on the shift; add them if not
  const { data: existing } = await supabase
    .from('shift_assignments')
    .select('id')
    .eq('shift_id', shift_id)
    .eq('volunteer_id', mentor_id)
    .maybeSingle()

  if (!existing) {
    const { error: mentorError } = await supabase.from('shift_assignments').insert({
      shift_id,
      volunteer_id: mentor_id,
      role: null,
      status: 'assigned',
    })
    if (mentorError) throw new Error(mentorError.message)
  }

  // Assign trainee linked to mentor
  const { error } = await supabase.from('shift_assignments').insert({
    shift_id,
    volunteer_id: trainee_id,
    role: role || null,
    status: 'assigned',
    mentor_id,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/shifts')
  revalidatePath('/volunteer/shifts')
}

export async function removeAssignment(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('shift_assignments').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
  revalidatePath('/volunteer/shifts')
}

// ─── Clock in / out ───────────────────────────────────────────────────────────

export async function manualClockIn(volunteer_id: string, shift_id: string, location_id: string | null) {
  const supabase = await createClient()

  // Check if already clocked in
  const { data: existing } = await supabase
    .from('time_entries')
    .select('id')
    .eq('volunteer_id', volunteer_id)
    .eq('shift_id', shift_id)
    .is('clock_out', null)
    .maybeSingle()

  if (existing) throw new Error('Volunteer is already clocked in for this shift')

  const { error } = await supabase.from('time_entries').insert({
    volunteer_id,
    shift_id,
    location_id,
    clock_in: new Date().toISOString(),
    method: 'admin',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
}

export async function manualClockOut(time_entry_id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('time_entries')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', time_entry_id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
}
