'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { FilterParams } from './page'

export async function approveHoursEntry(
  entryId: string,
): Promise<{ error?: string }> {
  let userId: string
  try {
    userId = (await requireAdmin()).id
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Admin access required.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('time_entries')
    .update({ approval_status: 'approved', approved_by: userId, approved_at: new Date().toISOString() })
    .eq('id', entryId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/reports')
  return {}
}

export async function rejectHoursEntry(
  entryId: string,
): Promise<{ error?: string }> {
  try {
    await requireAdmin()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Admin access required.' }
  }

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

  try {
    await requireAdmin()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Admin access required.' }
  }

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

export async function createSavedReport(input: {
  name: string
  reportType: string
  filters: FilterParams
}): Promise<{ id?: string; error?: string }> {
  let userId: string
  try {
    userId = (await requireAdmin()).id
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Admin access required.' }
  }

  const name = input.name.trim()
  if (!name) return { error: 'Name is required.' }

  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) return { error: 'No organization found.' }

  const { data, error } = await admin
    .from('saved_reports')
    .insert({
      org_id: org.id,
      name,
      report_type: input.reportType,
      filters: input.filters,
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/reports')
  return { id: data.id }
}
