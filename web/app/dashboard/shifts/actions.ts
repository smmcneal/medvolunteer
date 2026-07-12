'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function createShift(data: {
  name: string
  location_id: string | null
  start_time: string
  end_time: string
  required_count: number
  required_categories?: string[]
  notes: string
  volunteer_ids?: string[]
}): Promise<{ shiftId: string }> {
  // Use admin client so org lookup is never blocked by RLS
  await requireAdmin()
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

// ─── Recurring Shifts ─────────────────────────────────────────────────────────

export async function createRecurringShifts(data: {
  name: string
  location_id: string | null
  start_time: string
  end_time: string
  required_count: number
  required_categories?: string[]
  notes: string
}, frequency: 'weekly' | 'biweekly' | 'monthly', endDate: string | null) {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .limit(1)
    .single()
  if (!org) throw new Error('No organization found')

  const recurrence_group_id = randomUUID()
  const intervalDays = frequency === 'monthly' ? null : frequency === 'biweekly' ? 14 : 7
  const MAX_OCCURRENCES = 52

  const rows: object[] = []
  let start = new Date(data.start_time)
  const durationMs = new Date(data.end_time).getTime() - start.getTime()
  const cutoff = endDate ? new Date(endDate + 'T23:59:59Z') : null

  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    if (cutoff && start > cutoff) break
    rows.push({
      org_id: org.id,
      name: data.name,
      location_id: data.location_id,
      start_time: start.toISOString(),
      end_time: new Date(start.getTime() + durationMs).toISOString(),
      required_count: data.required_count,
      notes: data.notes || null,
      recurrence_rule: frequency,
      recurrence_group_id,
      recurrence_end_date: endDate ?? null,
    })

    if (frequency === 'monthly') {
      const next = new Date(start)
      next.setMonth(next.getMonth() + 1)
      start = next
    } else {
      start = new Date(start.getTime() + intervalDays! * 86400000)
    }
  }

  if (rows.length === 0) throw new Error('No occurrences generated for the given range')

  const { error } = await admin.from('shifts').insert(rows)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
  revalidatePath('/volunteer/shifts')
}

export async function bulkUpdateRecurringShifts(
  groupId: string,
  fromShiftId: string,
  data: { name?: string; location_id?: string | null; required_count?: number; notes?: string },
) {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: refShift } = await admin
    .from('shifts')
    .select('start_time')
    .eq('id', fromShiftId)
    .single()
  if (!refShift) throw new Error('Reference shift not found')

  const { error } = await admin
    .from('shifts')
    .update(data)
    .eq('recurrence_group_id', groupId)
    .gte('start_time', refShift.start_time)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
}

export async function bulkDeleteRecurringShifts(groupId: string, fromShiftId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: refShift } = await admin
    .from('shifts')
    .select('start_time')
    .eq('id', fromShiftId)
    .single()
  if (!refShift) throw new Error('Reference shift not found')

  const { error } = await admin
    .from('shifts')
    .delete()
    .eq('recurrence_group_id', groupId)
    .gte('start_time', refShift.start_time)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
}

export async function updateShift(id: string, data: {
  name?: string
  location_id?: string | null
  start_time?: string
  end_time?: string
  required_count?: number
  required_categories?: string[]
  notes?: string
}) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('shifts').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
}

export async function deleteShift(id: string) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('shifts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
}

export async function duplicateShift(id: string): Promise<{ shiftId: string }> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: shift, error: fetchError } = await admin
    .from('shifts')
    .select('org_id, name, location_id, start_time, end_time, required_count, required_categories, notes')
    .eq('id', id)
    .single()
  if (fetchError || !shift) throw new Error(fetchError?.message ?? 'Shift not found')

  // Standalone copy — no recurrence linkage, no carried-over assignments
  const { data: newShift, error } = await admin
    .from('shifts')
    .insert({
      org_id: shift.org_id,
      name: shift.name,
      location_id: shift.location_id,
      start_time: shift.start_time,
      end_time: shift.end_time,
      required_count: shift.required_count,
      required_categories: shift.required_categories,
      notes: shift.notes,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/shifts')
  revalidatePath('/volunteer/shifts')
  return { shiftId: newShift.id }
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export async function assignVolunteer(
  shift_id: string,
  volunteer_id: string,
  role = '',
  mentor_id?: string,
) {
  await requireAdmin()
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

  // Upsert: unique(shift_id, volunteer_id) means a cancelled row blocks re-insert
  const { data: existing } = await admin
    .from('shift_assignments')
    .select('id')
    .eq('shift_id', shift_id)
    .eq('volunteer_id', volunteer_id)
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('shift_assignments')
      .update({ status: 'assigned', role: role || null, mentor_id: mentor_id ?? null })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin.from('shift_assignments').insert({
      shift_id,
      volunteer_id,
      role: role || null,
      status: 'assigned',
      mentor_id: mentor_id ?? null,
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/dashboard/shifts')
  revalidatePath('/volunteer/shifts')
}

export async function assignTraineeWithMentor(
  shift_id: string,
  trainee_id: string,
  mentor_id: string,
  role = '',
) {
  await requireAdmin()
  const admin = createAdminClient()

  // Ensure mentor is on the shift — upsert to handle the unique(shift_id, volunteer_id) constraint
  const { data: existingMentor } = await admin
    .from('shift_assignments')
    .select('id, status')
    .eq('shift_id', shift_id)
    .eq('volunteer_id', mentor_id)
    .maybeSingle()

  if (!existingMentor) {
    const { error: mentorError } = await admin.from('shift_assignments').insert({
      shift_id,
      volunteer_id: mentor_id,
      role: null,
      status: 'assigned',
    })
    if (mentorError) throw new Error(mentorError.message)
  } else if (existingMentor.status === 'cancelled') {
    const { error: mentorError } = await admin
      .from('shift_assignments')
      .update({ status: 'assigned', role: null })
      .eq('id', existingMentor.id)
    if (mentorError) throw new Error(mentorError.message)
  }

  // Assign trainee linked to mentor — upsert for same reason
  const { data: existingTrainee } = await admin
    .from('shift_assignments')
    .select('id')
    .eq('shift_id', shift_id)
    .eq('volunteer_id', trainee_id)
    .maybeSingle()

  if (existingTrainee) {
    const { error } = await admin
      .from('shift_assignments')
      .update({ status: 'assigned', role: role || null, mentor_id })
      .eq('id', existingTrainee.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin.from('shift_assignments').insert({
      shift_id,
      volunteer_id: trainee_id,
      role: role || null,
      status: 'assigned',
      mentor_id,
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/dashboard/shifts')
  revalidatePath('/volunteer/shifts')
}

export async function removeAssignment(id: string) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('shift_assignments').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
  revalidatePath('/volunteer/shifts')
}

// ─── Clock in / out ───────────────────────────────────────────────────────────

export async function manualClockIn(volunteer_id: string, shift_id: string, location_id: string | null) {
  await requireAdmin()
  const admin = createAdminClient()

  // Check if already clocked in
  const { data: existing } = await admin
    .from('time_entries')
    .select('id')
    .eq('volunteer_id', volunteer_id)
    .eq('shift_id', shift_id)
    .is('clock_out', null)
    .maybeSingle()

  if (existing) throw new Error('Volunteer is already clocked in for this shift')

  const { error } = await admin.from('time_entries').insert({
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
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('time_entries')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', time_entry_id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/shifts')
}
