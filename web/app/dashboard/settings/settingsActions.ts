'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function createTag(name: string, color: string): Promise<{ error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) return { error: 'Organization not found.' }

  const { error } = await admin.from('org_tags').insert({ org_id: org.id, name: name.trim(), color })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return {}
}

export async function updateTag(id: string, name: string, color: string): Promise<{ error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('org_tags').update({ name: name.trim(), color }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/volunteers')
  return {}
}

export async function deleteTag(id: string): Promise<{ error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('org_tags').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/volunteers')
  return {}
}

// ─── Flags ────────────────────────────────────────────────────────────────────

export async function createFlag(
  name: string,
  description: string,
  severity: 'info' | 'warning' | 'critical',
  color: string,
): Promise<{ error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) return { error: 'Organization not found.' }

  const { error } = await admin.from('org_flags').insert({
    org_id: org.id,
    name: name.trim(),
    description: description.trim() || null,
    severity,
    color,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return {}
}

export async function updateFlag(
  id: string,
  name: string,
  description: string,
  severity: 'info' | 'warning' | 'critical',
  color: string,
): Promise<{ error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('org_flags').update({
    name: name.trim(),
    description: description.trim() || null,
    severity,
    color,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return {}
}

export async function deleteFlag(id: string): Promise<{ error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('org_flags').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return {}
}
