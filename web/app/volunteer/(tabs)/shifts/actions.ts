'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireVolunteer } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function volunteerClockIn(
  shiftId: string,
  locationId: string | null,
  method: 'manual' | 'geofence'
): Promise<{ entryId: string; alreadyClockedIn: boolean }> {
  const { volunteerId } = await requireVolunteer()
  const admin = createAdminClient()

  // Must be assigned to this shift (soft-deleted assignments don't count)
  const { data: assignment } = await admin
    .from('shift_assignments')
    .select('id, shifts(start_time, end_time)')
    .eq('shift_id', shiftId)
    .eq('volunteer_id', volunteerId)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (!assignment) throw new Error('You are not assigned to this shift')

  // Clock-in window: from 2 hours before start until the shift ends
  const shift = assignment.shifts as unknown as { start_time: string; end_time: string }
  const now = Date.now()
  const windowOpen = new Date(shift.start_time).getTime() - 2 * 3600_000
  const windowClose = new Date(shift.end_time).getTime()
  if (now < windowOpen) throw new Error('Too early to clock in for this shift')
  if (now > windowClose) throw new Error('This shift has already ended')

  // Guard: don't double-clock-in for the same shift
  const { data: existing } = await admin
    .from('time_entries')
    .select('id')
    .eq('volunteer_id', volunteerId)
    .eq('shift_id', shiftId)
    .is('clock_out', null)
    .maybeSingle()

  if (existing) return { entryId: existing.id, alreadyClockedIn: true }

  const { data, error } = await admin
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
  const { user } = await requireVolunteer()
  const admin = createAdminClient()

  // Fetch the entry and verify ownership via the volunteers join
  const { data: entry } = await admin
    .from('time_entries')
    .select('id, clock_in, clock_out, volunteers(user_id)')
    .eq('id', timeEntryId)
    .single()

  const owner = (entry?.volunteers as unknown as { user_id: string } | null)?.user_id
  if (!entry || owner !== user.id) throw new Error('Entry not found or access denied')
  if (entry.clock_out) throw new Error('Already clocked out')

  // Check org setting to determine approval status
  const { data: orgData } = await admin.from('organizations').select('settings').limit(1).single()
  const requireApproval = !!(orgData?.settings as Record<string, unknown>)?.require_hour_approval
  const approvalStatus = requireApproval ? 'pending' : 'auto_approved'

  const { error } = await admin
    .from('time_entries')
    .update({ clock_out: new Date().toISOString(), approval_status: approvalStatus })
    .eq('id', timeEntryId)
    .is('clock_out', null)

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/shifts')
}

/**
 * Activates an assignment for the volunteer on the given shift.
 * unique(shift_id, volunteer_id) means a previously-cancelled row blocks a
 * plain insert, so this re-activates the cancelled row when one exists.
 */
async function upsertAssignment(
  admin: ReturnType<typeof createAdminClient>,
  shiftId: string,
  volunteerId: string,
): Promise<{ assignmentId: string }> {
  const { data: existing } = await admin
    .from('shift_assignments')
    .select('id, status')
    .eq('shift_id', shiftId)
    .eq('volunteer_id', volunteerId)
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('shift_assignments')
      .update({ status: 'assigned' })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
    return { assignmentId: existing.id }
  }

  const { data: created, error } = await admin
    .from('shift_assignments')
    .insert({ shift_id: shiftId, volunteer_id: volunteerId, status: 'assigned' })
    .select('id')
    .single()
  if (error || !created) throw new Error(error?.message ?? 'Failed to create assignment')
  return { assignmentId: created.id }
}

export async function volunteerSignUpForShift(shiftId: string): Promise<void> {
  const { user } = await requireVolunteer()
  const admin = createAdminClient()

  const { data: volunteer } = await admin
    .from('volunteers')
    .select('id, status, pipeline_phase, org_id, volunteer_categories')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) throw new Error('Volunteer not found')
  if (volunteer.status !== 'volunteer') {
    throw new Error('Only active volunteers can sign up for shifts')
  }

  const { data: shift } = await admin
    .from('shifts')
    .select('id, start_time, required_count, org_id, required_categories')
    .eq('id', shiftId)
    .eq('org_id', volunteer.org_id)
    .single()

  if (!shift) throw new Error('Shift not found')

  const requiredCats: string[] = (shift as { required_categories?: string[] }).required_categories ?? []
  const volunteerCats: string[] = (volunteer as { volunteer_categories?: string[] }).volunteer_categories ?? []
  if (requiredCats.length > 0 && !volunteerCats.some((c: string) => requiredCats.includes(c))) {
    throw new Error('You are not eligible to sign up for this shift')
  }
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

  // Capacity is also enforced by the shift_capacity_check DB trigger, which
  // closes the race two concurrent sign-ups could otherwise win together.
  await upsertAssignment(admin, shiftId, volunteer.id)

  revalidatePath('/volunteer/shifts')
  revalidatePath('/dashboard/shifts')
}

export async function volunteerMoveShift(
  oldAssignmentId: string,
  newShiftId: string,
): Promise<{ newAssignmentId: string }> {
  const { user } = await requireVolunteer()
  const admin = createAdminClient()

  const { data: volunteer } = await admin.from('volunteers').select('id, org_id, status, pipeline_phase, volunteer_categories').eq('user_id', user.id).single()
  if (!volunteer) throw new Error('Volunteer not found')
  if (volunteer.status !== 'volunteer') throw new Error('Only active volunteers can change shifts')

  // Verify old assignment belongs to this volunteer
  const { data: oldAssignment } = await admin.from('shift_assignments').select('id, volunteer_id, status, shifts(start_time)').eq('id', oldAssignmentId).single()
  if (!oldAssignment || oldAssignment.volunteer_id !== volunteer.id) throw new Error('Assignment not found')
  if (oldAssignment.status === 'cancelled') throw new Error('Assignment is already cancelled')
  const shiftStart = new Date((oldAssignment.shifts as unknown as { start_time: string }).start_time)
  if (new Date() >= shiftStart) throw new Error('Cannot move a shift that has already started')

  // Verify new shift exists, belongs to org, is in the future, and has space
  const { data: newShift } = await admin.from('shifts').select('id, start_time, required_count, org_id, required_categories').eq('id', newShiftId).eq('org_id', volunteer.org_id).single()
  if (!newShift) throw new Error('Shift not found')
  if (new Date(newShift.start_time) <= new Date()) throw new Error('Cannot move to a shift that has already started')

  const newRequiredCats: string[] = (newShift as { required_categories?: string[] }).required_categories ?? []
  const volunteerCats: string[] = (volunteer as { volunteer_categories?: string[] }).volunteer_categories ?? []
  if (newRequiredCats.length > 0 && !volunteerCats.some((c: string) => newRequiredCats.includes(c))) {
    throw new Error('You are not eligible for that shift')
  }

  const { count } = await admin.from('shift_assignments').select('id', { count: 'exact', head: true }).eq('shift_id', newShiftId).neq('status', 'cancelled')
  if ((count ?? 0) >= newShift.required_count) throw new Error('That shift is now full')

  // Cancel old
  const { error: cancelErr } = await admin.from('shift_assignments').update({ status: 'cancelled' }).eq('id', oldAssignmentId)
  if (cancelErr) throw new Error(cancelErr.message)

  // Create (or re-activate) the new assignment
  try {
    const { assignmentId } = await upsertAssignment(admin, newShiftId, volunteer.id)
    revalidatePath('/volunteer/shifts')
    revalidatePath('/dashboard/shifts')
    return { newAssignmentId: assignmentId }
  } catch (e) {
    // Rollback the cancellation
    await admin.from('shift_assignments').update({ status: 'assigned' }).eq('id', oldAssignmentId)
    throw e instanceof Error ? e : new Error('Failed to create new assignment')
  }
}

export async function volunteerRequestReschedule(
  assignmentId: string,
  note: string,
): Promise<void> {
  const { user, volunteerId } = await requireVolunteer()
  const admin = createAdminClient()

  // Verify ownership
  const { data: assignment } = await admin.from('shift_assignments').select('id, volunteer_id, shifts(name, start_time)').eq('id', assignmentId).single()
  if (!assignment || assignment.volunteer_id !== volunteerId) throw new Error('Assignment not found')

  const shiftInfo = assignment.shifts as unknown as { name: string; start_time: string } | null
  const content = `Reschedule request for shift "${shiftInfo?.name ?? 'Unknown'}" (${shiftInfo?.start_time ? new Date(shiftInfo.start_time).toLocaleDateString() : 'unknown date'})${note ? ': ' + note : ''}`

  await admin.from('volunteer_notes').insert({ volunteer_id: volunteerId, content, created_by: user.id })
  revalidatePath('/volunteer/shifts')
}

export async function volunteerDropShift(assignmentId: string): Promise<void> {
  const { volunteerId } = await requireVolunteer()
  const admin = createAdminClient()

  const { data: assignment } = await admin
    .from('shift_assignments')
    .select('id, volunteer_id, status, shifts(start_time)')
    .eq('id', assignmentId)
    .single()

  if (!assignment) throw new Error('Assignment not found')
  if (assignment.volunteer_id !== volunteerId) throw new Error('Access denied')
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

export interface RescheduleOption {
  id: string
  name: string
  start_time: string
  end_time: string
  location_name: string | null
  spots_left: number | null
}

/**
 * Future shifts with the same name the volunteer could move to.
 * Replaces the old client-side Supabase query in RescheduleModal — volunteer
 * clients no longer have direct database access.
 */
export async function getRescheduleOptions(
  shiftName: string,
  currentShiftId: string,
): Promise<RescheduleOption[]> {
  const { volunteerId } = await requireVolunteer()
  const admin = createAdminClient()

  const { data: volunteer } = await admin
    .from('volunteers')
    .select('org_id')
    .eq('id', volunteerId)
    .single()
  if (!volunteer) return []

  const now = new Date().toISOString()
  const { data: shifts } = await admin
    .from('shifts')
    .select(`
      id, name, start_time, end_time, required_count,
      location:locations(name),
      shift_assignments(status)
    `)
    .eq('org_id', volunteer.org_id)
    .eq('name', shiftName)
    .eq('is_published', true)
    .gte('start_time', now)
    .neq('id', currentShiftId)
    .order('start_time', { ascending: true })
    .limit(10)

  type ShiftRow = {
    id: string
    name: string
    start_time: string
    end_time: string
    required_count: number | null
    location: { name: string } | null
    shift_assignments: { status: string }[] | null
  }

  return ((shifts ?? []) as unknown as ShiftRow[])
    .map(s => {
      // Soft-deleted assignments don't occupy a slot
      const assigned = (s.shift_assignments ?? [])
        .filter((a: { status: string }) => a.status !== 'cancelled').length
      const spotsLeft = s.required_count != null ? Math.max(s.required_count - assigned, 0) : null
      if (spotsLeft !== null && spotsLeft <= 0) return null
      return {
        id: s.id,
        name: s.name,
        start_time: s.start_time,
        end_time: s.end_time,
        location_name: s.location?.name ?? null,
        spots_left: spotsLeft,
      }
    })
    .filter((x): x is RescheduleOption => x !== null)
}
