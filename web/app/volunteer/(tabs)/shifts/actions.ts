'use server'

import { createClient } from '@/lib/supabase/server'
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
