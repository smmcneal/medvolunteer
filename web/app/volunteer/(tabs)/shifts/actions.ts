'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getVolunteerId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: volunteer } = await supabase
    .from('volunteers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) throw new Error('Volunteer not found')
  return { supabase, volunteerId: volunteer.id as string }
}

export async function volunteerClockIn(
  shiftId: string,
  locationId: string | null,
  method: 'manual' | 'geofence'
): Promise<{ entryId: string; alreadyClockedIn: boolean }> {
  const { supabase, volunteerId } = await getVolunteerId()

  // Guard: don't double-clock-in for the same shift
  const { data: existing } = await supabase
    .from('time_entries')
    .select('id')
    .eq('volunteer_id', volunteerId)
    .eq('shift_id', shiftId)
    .is('clock_out', null)
    .maybeSingle()

  if (existing) return { entryId: existing.id, alreadyClockedIn: true }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      volunteer_id: volunteerId,
      shift_id: shiftId,
      location_id: locationId,
      clock_in: new Date().toISOString(),
      method,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/shifts')
  return { entryId: data.id, alreadyClockedIn: false }
}

export async function volunteerClockOut(timeEntryId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch the entry and verify ownership via the volunteers join
  const { data: entry } = await supabase
    .from('time_entries')
    .select('id, clock_in, volunteers(user_id)')
    .eq('id', timeEntryId)
    .single()

  const owner = (entry?.volunteers as unknown as { user_id: string } | null)?.user_id
  if (!entry || owner !== user.id) throw new Error('Entry not found or access denied')

  const clockOut = new Date().toISOString()

  const { error } = await supabase
    .from('time_entries')
    .update({ clock_out: clockOut })
    .eq('id', timeEntryId)

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/shifts')
}

export async function volunteerSignUpForShift(shiftId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()

  const { data: volunteer } = await admin
    .from('volunteers')
    .select('id, status, pipeline_phase, org_id')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) throw new Error('Volunteer not found')
  if (volunteer.status !== 'volunteer' || volunteer.pipeline_phase !== 'active') {
    throw new Error('Only active volunteers can sign up for shifts')
  }

  const { data: shift } = await admin
    .from('shifts')
    .select('id, start_time, required_count, org_id')
    .eq('id', shiftId)
    .eq('org_id', volunteer.org_id)
    .single()

  if (!shift) throw new Error('Shift not found')
  if (new Date(shift.start_time) <= new Date()) throw new Error('Cannot sign up for a shift that has already started')

  const { data: existing } = await admin
    .from('shift_assignments')
    .select('id')
    .eq('shift_id', shiftId)
    .eq('volunteer_id', volunteer.id)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existing) throw new Error('You are already signed up for this shift')

  const { count } = await admin
    .from('shift_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('shift_id', shiftId)
    .neq('status', 'cancelled')

  if ((count ?? 0) >= shift.required_count) throw new Error('This shift is full')

  const { error } = await admin
    .from('shift_assignments')
    .insert({ shift_id: shiftId, volunteer_id: volunteer.id, status: 'assigned' })

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/shifts')
  revalidatePath('/dashboard/shifts')
}

export async function volunteerDropShift(assignmentId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()

  const { data: volunteer } = await admin
    .from('volunteers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) throw new Error('Volunteer not found')

  const { data: assignment } = await admin
    .from('shift_assignments')
    .select('id, volunteer_id, status, shifts(start_time)')
    .eq('id', assignmentId)
    .single()

  if (!assignment) throw new Error('Assignment not found')
  if (assignment.volunteer_id !== volunteer.id) throw new Error('Access denied')
  if (assignment.status === 'cancelled') throw new Error('Assignment is already cancelled')

  const shiftStart = new Date((assignment.shifts as unknown as { start_time: string }).start_time)
  const cutoff = new Date(shiftStart.getTime() - 24 * 60 * 60 * 1000)
  if (new Date() >= cutoff) throw new Error('Cannot drop a shift within 24 hours of start time')

  const { error } = await admin
    .from('shift_assignments')
    .update({ status: 'cancelled' })
    .eq('id', assignmentId)

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/shifts')
  revalidatePath('/dashboard/shifts')
}
