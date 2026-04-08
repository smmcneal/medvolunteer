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
  if (volunteer.status !== 'volunteer') {
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

export async function volunteerMoveShift(
  oldAssignmentId: string,
  newShiftId: string,
): Promise<{ newAssignmentId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data: volunteer } = await admin.from('volunteers').select('id, org_id, status, pipeline_phase').eq('user_id', user.id).single()
  if (!volunteer) throw new Error('Volunteer not found')
  if (volunteer.status !== 'volunteer') throw new Error('Only active volunteers can change shifts')

  // Verify old assignment belongs to this volunteer
  const { data: oldAssignment } = await admin.from('shift_assignments').select('id, volunteer_id, status, shifts(start_time)').eq('id', oldAssignmentId).single()
  if (!oldAssignment || oldAssignment.volunteer_id !== volunteer.id) throw new Error('Assignment not found')
  if (oldAssignment.status === 'cancelled') throw new Error('Assignment is already cancelled')
  const shiftStart = new Date((oldAssignment.shifts as unknown as { start_time: string }).start_time)
  if (new Date() >= shiftStart) throw new Error('Cannot move a shift that has already started')

  // Verify new shift exists, belongs to org, is in the future, and has space
  const { data: newShift } = await admin.from('shifts').select('id, start_time, required_count, org_id').eq('id', newShiftId).eq('org_id', volunteer.org_id).single()
  if (!newShift) throw new Error('Shift not found')
  if (new Date(newShift.start_time) <= new Date()) throw new Error('Cannot move to a shift that has already started')
  const { count } = await admin.from('shift_assignments').select('id', { count: 'exact', head: true }).eq('shift_id', newShiftId).neq('status', 'cancelled')
  if ((count ?? 0) >= newShift.required_count) throw new Error('That shift is now full')

  // Cancel old
  const { error: cancelErr } = await admin.from('shift_assignments').update({ status: 'cancelled' }).eq('id', oldAssignmentId)
  if (cancelErr) throw new Error(cancelErr.message)

  // Create new
  const { data: newAssignment, error: createErr } = await admin.from('shift_assignments').insert({ shift_id: newShiftId, volunteer_id: volunteer.id, status: 'assigned' }).select('id').single()
  if (createErr || !newAssignment) {
    // Rollback
    await admin.from('shift_assignments').update({ status: 'assigned' }).eq('id', oldAssignmentId)
    throw new Error(createErr?.message ?? 'Failed to create new assignment')
  }

  revalidatePath('/volunteer/shifts')
  revalidatePath('/dashboard/shifts')
  return { newAssignmentId: newAssignment.id }
}

export async function volunteerRequestReschedule(
  assignmentId: string,
  note: string,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data: volunteer } = await admin.from('volunteers').select('id').eq('user_id', user.id).single()
  if (!volunteer) throw new Error('Volunteer not found')

  // Verify ownership
  const { data: assignment } = await admin.from('shift_assignments').select('id, volunteer_id, shifts(name, start_time)').eq('id', assignmentId).single()
  if (!assignment || assignment.volunteer_id !== volunteer.id) throw new Error('Assignment not found')

  const shiftInfo = assignment.shifts as unknown as { name: string; start_time: string } | null
  const content = `Reschedule request for shift "${shiftInfo?.name ?? 'Unknown'}" (${shiftInfo?.start_time ? new Date(shiftInfo.start_time).toLocaleDateString() : 'unknown date'})${note ? ': ' + note : ''}`

  await admin.from('volunteer_notes').insert({ volunteer_id: volunteer.id, content, created_by: user.id })
  revalidatePath('/volunteer/shifts')
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
  if (new Date() >= shiftStart) throw new Error('Cannot drop a shift that has already started')

  const { error } = await admin
    .from('shift_assignments')
    .update({ status: 'cancelled' })
    .eq('id', assignmentId)

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/shifts')
  revalidatePath('/dashboard/shifts')
}
