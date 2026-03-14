'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function createShift(data: {
  name: string
  location_id: string | null
  start_time: string
  end_time: string
  required_count: number
  notes: string
}) {
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single()

  if (!org) throw new Error('No organization found')

  const { error } = await supabase.from('shifts').insert({
    org_id: org.id,
    ...data,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
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

export async function assignVolunteer(shift_id: string, volunteer_id: string, role = '') {
  const supabase = await createClient()
  const { error } = await supabase.from('shift_assignments').insert({
    shift_id, volunteer_id, role: role || null, status: 'assigned',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
}

export async function removeAssignment(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('shift_assignments').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
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
