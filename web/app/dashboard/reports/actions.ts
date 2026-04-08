'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function approveHoursEntry(
  entryId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('time_entries')
    .update({ approval_status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', entryId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/reports')
  return {}
}

export async function rejectHoursEntry(
  entryId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('time_entries')
    .update({ approval_status: 'rejected' })
    .eq('id', entryId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/reports')
  return {}
}

export async function bulkMarkInactive(
  volunteerIds: string[],
): Promise<{ error?: string }> {
  if (!volunteerIds.length) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()

  const { error } = await admin
    .from('volunteers')
    .update({ status: 'inactive' })
    .in('id', volunteerIds)
    .eq('status', 'volunteer')

  if (error) return { error: error.message }

  revalidatePath('/dashboard/reports')
  revalidatePath('/dashboard/volunteers')
  return {}
}
