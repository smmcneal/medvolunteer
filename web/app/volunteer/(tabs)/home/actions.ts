'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getVolunteerId() {
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
  return { supabase: admin, volunteerId: volunteer.id as string }
}

export async function homeClockIn(): Promise<{ entryId: string }> {
  const { supabase, volunteerId } = await getVolunteerId()

  // Guard: don't double-clock-in
  const { data: existing } = await supabase
    .from('time_entries')
    .select('id')
    .eq('volunteer_id', volunteerId)
    .is('clock_out', null)
    .maybeSingle()

  if (existing) return { entryId: existing.id }

  const { data, error } = await supabase
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
  const { supabase, volunteerId } = await getVolunteerId()

  const { data: assignment } = await supabase
    .from('shift_assignments')
    .select('id, volunteer_id, status, shifts(start_time)')
    .eq('id', assignmentId)
    .single()

  if (!assignment || assignment.volunteer_id !== volunteerId) throw new Error('Assignment not found')
  if (assignment.status === 'cancelled') throw new Error('Already cancelled')

  const shiftStart = new Date((assignment.shifts as unknown as { start_time: string }).start_time)
  if (new Date() >= shiftStart) throw new Error('Cannot drop a shift that has already started')

  const { error } = await supabase
    .from('shift_assignments')
    .update({ status: 'cancelled' })
    .eq('id', assignmentId)

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/home')
  revalidatePath('/volunteer/shifts')
  revalidatePath('/dashboard/shifts')
}

export async function homeClockOut(entryId: string): Promise<void> {
  const { supabase } = await getVolunteerId()

  const { error } = await supabase
    .from('time_entries')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', entryId)

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/home')
  revalidatePath('/dashboard')
}
