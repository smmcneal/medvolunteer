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
