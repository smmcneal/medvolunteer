'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireVolunteer } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function homeClockIn(): Promise<{ entryId: string }> {
  const { volunteerId } = await requireVolunteer()
  const admin = createAdminClient()

  // Guard: don't double-clock-in
  const { data: existing } = await admin
    .from('time_entries')
    .select('id')
    .eq('volunteer_id', volunteerId)
    .is('clock_out', null)
    .maybeSingle()

  if (existing) return { entryId: existing.id }

  const { data, error } = await admin
    .from('time_entries')
    .insert({
      volunteer_id: volunteerId,
      shift_id: null,
      location_id: null,
      clock_in: new Date().toISOString(),
      method: 'manual',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/home')
  revalidatePath('/dashboard')
  return { entryId: data.id }
}

export async function homeDropShift(assignmentId: string): Promise<void> {
  const { volunteerId } = await requireVolunteer()
  const admin = createAdminClient()

  const { data: assignment } = await admin
    .from('shift_assignments')
    .select('id, volunteer_id, status, shifts(start_time)')
    .eq('id', assignmentId)
    .single()

  if (!assignment || assignment.volunteer_id !== volunteerId) throw new Error('Assignment not found')
  if (assignment.status === 'cancelled') throw new Error('Already cancelled')

  const shiftStart = new Date((assignment.shifts as unknown as { start_time: string }).start_time)
  if (new Date() >= shiftStart) throw new Error('Cannot drop a shift that has already started')

  const { error } = await admin
    .from('shift_assignments')
    .update({ status: 'cancelled' })
    .eq('id', assignmentId)

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/home')
  revalidatePath('/volunteer/shifts')
  revalidatePath('/dashboard/shifts')
}

export async function homeClockOut(entryId: string): Promise<void> {
  const { volunteerId } = await requireVolunteer()
  const admin = createAdminClient()

  // Ownership check — the entry must belong to the calling volunteer
  const { data: entry } = await admin
    .from('time_entries')
    .select('id, volunteer_id, clock_out')
    .eq('id', entryId)
    .single()

  if (!entry || entry.volunteer_id !== volunteerId) throw new Error('Entry not found or access denied')
  if (entry.clock_out) throw new Error('Already clocked out')

  // Match the shifts-tab clock-out: respect the org's hour-approval setting
  const { data: orgData } = await admin.from('organizations').select('settings').limit(1).single()
  const requireApproval = !!(orgData?.settings as Record<string, unknown>)?.require_hour_approval
  const approvalStatus = requireApproval ? 'pending' : 'auto_approved'

  const { error } = await admin
    .from('time_entries')
    .update({ clock_out: new Date().toISOString(), approval_status: approvalStatus })
    .eq('id', entryId)
    .is('clock_out', null)

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/home')
  revalidatePath('/dashboard')
}
