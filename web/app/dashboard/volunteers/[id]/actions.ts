'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PipelinePhase, VolunteerStatus } from '@/types/database'

// Phase → status mapping (single source of truth)
const PHASE_STATUS_MAP: Record<PipelinePhase, VolunteerStatus> = {
  intake:       'applicant',
  orientation:  'prospect',
  review:       'prospect',
  training:     'prospect',
  active:       'volunteer',
  offboarding:  'inactive',
}

// ─── Pipeline phase ───────────────────────────────────────────────────────────

export async function updatePipelinePhase(
  volunteerId: string,
  phase: PipelinePhase,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const status = PHASE_STATUS_MAP[phase]

  const { error } = await admin
    .from('volunteers')
    .update({ pipeline_phase: phase, status })
    .eq('id', volunteerId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/volunteers/${volunteerId}`)
  revalidatePath('/dashboard/volunteers')
  return {}
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function addNote(
  volunteerId: string,
  content: string,
): Promise<{ error?: string }> {
  if (!content.trim()) return { error: 'Note cannot be empty.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { error } = await admin.from('volunteer_notes').insert({
    volunteer_id: volunteerId,
    content: content.trim(),
    created_by: user?.id ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/volunteers/${volunteerId}`)
  return {}
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function applyTag(
  volunteerId: string,
  tagId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('volunteer_tags').insert({
    volunteer_id: volunteerId,
    tag_id: tagId,
  })
  if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) {
    return { error: error.message }
  }
  revalidatePath('/dashboard/volunteers')
  return {}
}

export async function removeTag(
  volunteerId: string,
  tagId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('volunteer_tags')
    .delete()
    .eq('volunteer_id', volunteerId)
    .eq('tag_id', tagId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/volunteers')
  return {}
}

// ─── Flags ────────────────────────────────────────────────────────────────────

export async function raiseFlag(
  volunteerId: string,
  flagId: string,
  notes?: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('volunteer_flags').insert({
    volunteer_id: volunteerId,
    flag_id: flagId,
    notes: notes?.trim() || null,
  })
  if (error) return { error: error.message }
  return {}
}

export async function resolveFlag(flagAssignmentId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { error } = await admin
    .from('volunteer_flags')
    .update({ resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
    .eq('id', flagAssignmentId)

  if (error) return { error: error.message }
  return {}
}

// ─── Clock in / out ───────────────────────────────────────────────────────────

export async function clockIn(
  volunteerId: string,
): Promise<{ error?: string; entryId?: string }> {
  const admin = createAdminClient()

  // Prevent duplicate open entries
  const { data: existing } = await admin
    .from('time_entries')
    .select('id')
    .eq('volunteer_id', volunteerId)
    .is('clock_out', null)
    .maybeSingle()

  if (existing) return { error: 'Volunteer is already clocked in.' }

  const { data, error } = await admin
    .from('time_entries')
    .insert({ volunteer_id: volunteerId, clock_in: new Date().toISOString(), method: 'admin' })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/volunteers/${volunteerId}`)
  revalidatePath('/dashboard')
  return { entryId: data.id }
}

export async function clockOut(
  entryId: string,
  volunteerId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('time_entries')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', entryId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/volunteers/${volunteerId}`)
  revalidatePath('/dashboard')
  return {}
}
