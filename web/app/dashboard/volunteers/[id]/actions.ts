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

// ─── Volunteer info ───────────────────────────────────────────────────────────

export async function updateVolunteerInfo(
  volunteerId: string,
  data: {
    first_name: string
    last_name: string
    email: string
    phone: string
    category: string
    volunteer_categories?: string[]
  },
): Promise<{ error?: string }> {
  if (!data.first_name.trim()) return { error: 'First name is required.' }
  if (!data.last_name.trim())  return { error: 'Last name is required.' }
  if (!data.email.trim())      return { error: 'Email is required.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return { error: 'Enter a valid email address.' }

  const cats = data.volunteer_categories?.length ? data.volunteer_categories : [data.category]
  const admin = createAdminClient()
  const { error } = await admin
    .from('volunteers')
    .update({
      first_name:           data.first_name.trim(),
      last_name:            data.last_name.trim(),
      email:                data.email.trim().toLowerCase(),
      phone:                data.phone.trim() || null,
      category:             cats[0],
      volunteer_categories: cats,
    })
    .eq('id', volunteerId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/volunteers/${volunteerId}`)
  revalidatePath('/dashboard/volunteers')
  return {}
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

export async function unresolveFlag(flagAssignmentId: string): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('volunteer_flags')
    .update({ resolved_at: null, resolved_by: null })
    .eq('id', flagAssignmentId)
  if (error) return { error: error.message }
  return {}
}

// ─── Locations ────────────────────────────────────────────────────────────────

export async function updateVolunteerLocations(
  volunteerId: string,
  locationIds: string[],
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  // Replace all assignments atomically: delete then re-insert
  const { error: deleteError } = await admin
    .from('volunteer_locations')
    .delete()
    .eq('volunteer_id', volunteerId)

  if (deleteError) return { error: deleteError.message }

  if (locationIds.length > 0) {
    const { error: insertError } = await admin
      .from('volunteer_locations')
      .insert(locationIds.map(location_id => ({ volunteer_id: volunteerId, location_id })))

    if (insertError) return { error: insertError.message }
  }

  revalidatePath(`/dashboard/volunteers/${volunteerId}`)
  revalidatePath('/dashboard/volunteers')
  return {}
}

// ─── File uploads ─────────────────────────────────────────────────────────────

export async function uploadVolunteerDocument(
  formData: FormData,
): Promise<{ error?: string }> {
  const file = formData.get('file') as File | null
  const volunteerId = formData.get('volunteerId') as string | null

  if (!file || !volunteerId) return { error: 'Missing file or volunteer ID.' }
  if (file.size > 52_428_800) return { error: 'File must be under 50 MB.' }

  const admin = createAdminClient()

  // Ensure the bucket exists (creates it on first use if the migration hasn't been applied yet)
  const { error: bucketError } = await admin.storage.createBucket('volunteer-documents', {
    public: false,
    fileSizeLimit: 52_428_800,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain',
    ],
  })
  // Ignore "already exists" errors; surface anything else
  if (bucketError && !bucketError.message.toLowerCase().includes('already exists')) {
    return { error: bucketError.message }
  }

  // Derive a unique storage path
  const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
  const safeName = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
  const path = `${volunteerId}/${safeName}`

  const bytes = await file.arrayBuffer()
  const { error: storageError } = await admin.storage
    .from('volunteer-documents')
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (storageError) return { error: storageError.message }

  // Record who uploaded it
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error: dbError } = await admin.from('volunteer_uploads').insert({
    volunteer_id: volunteerId,
    name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    storage_path: path,
    uploaded_by: user?.id ?? null,
  })

  if (dbError) {
    // Clean up storage if DB insert fails
    await admin.storage.from('volunteer-documents').remove([path])
    return { error: dbError.message }
  }

  // ─── Fire document automation alerts ──────────────────────────────────────
  try {
    const { data: rules } = await admin
      .from('document_automation_rules')
      .select('trigger_document_type, alert_message, assigned_to')

    if (rules?.length) {
      const lowerName = file.name.toLowerCase()
      const matches = rules.filter(r =>
        r.trigger_document_type &&
        lowerName.includes(r.trigger_document_type.toLowerCase())
      )
      if (matches.length) {
        await admin.from('internal_alerts').insert(
          matches.map(r => ({
            triggered_by:  user?.id ?? null,
            assigned_to:   r.assigned_to ?? null,
            volunteer_id:  volunteerId,
            message:       r.alert_message,
            action_type:   'document_added',
          }))
        )
      }
    }
  } catch (err) {
    // Alert creation is non-fatal — never block the upload response
    console.error('[document-automation] alert insert failed:', err)
  }

  revalidatePath(`/dashboard/volunteers/${volunteerId}`)
  return {}
}

export async function deleteVolunteerUpload(
  uploadId: string,
  storagePath: string,
  volunteerId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  await admin.storage.from('volunteer-documents').remove([storagePath])

  const { error } = await admin.from('volunteer_uploads').delete().eq('id', uploadId)
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/volunteers/${volunteerId}`)
  return {}
}

export async function getUploadSignedUrl(
  storagePath: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('volunteer-documents')
    .createSignedUrl(storagePath, 3600) // 1-hour expiry

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

// ─── Onboarding checklist ─────────────────────────────────────────────────────

export type ChecklistField =
  | 'checklist_bg_form_signed'
  | 'checklist_video_watched'
  | 'checklist_id_verified'
  | 'checklist_certifications_submitted'

export async function toggleChecklistItem(
  volunteerId: string,
  field: ChecklistField,
  value: boolean,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('volunteers')
    .update({ [field]: value })
    .eq('id', volunteerId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/volunteers/${volunteerId}`)
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

// ─── Jotform ──────────────────────────────────────────────────────────────────

export async function sendJotformRequest(
  volunteerId: string,
  formId: string,
): Promise<{ error?: string }> {
  if (!formId.trim()) return { error: 'Form ID is required' }
  const admin = createAdminClient()

  const { data: vol } = await admin
    .from('volunteers')
    .select('email')
    .eq('id', volunteerId)
    .single()
  if (!vol) return { error: 'Volunteer not found' }

  const { data: org } = await admin
    .from('organizations')
    .select('settings')
    .limit(1)
    .single()
  const apiKey = (org?.settings as Record<string, unknown>)?.jotform_api_key as string | undefined
  if (!apiKey) return { error: 'Jotform API key not configured. Add it in Settings → Integrations.' }

  const res = await fetch(`https://api.jotform.com/form/${formId.trim()}/submissions?apiKey=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'submission[email]': vol.email }),
  })
  if (!res.ok) return { error: `Jotform API error: ${await res.text()}` }

  await admin.from('documents').insert({
    volunteer_id: volunteerId,
    name: `Jotform Request (Form ${formId.trim()})`,
    provider: 'jotform',
    status: 'pending',
  })

  // Evaluate document automation rules
  const { data: docRules } = await admin.from('document_automation_rules').select('*')
  if (docRules?.length) {
    const matched = docRules.filter(r => r.trigger_document_type.toLowerCase() === 'jotform request')
    if (matched.length) {
      await Promise.all(matched.map((rule: { assigned_to: string | null; alert_message: string }) =>
        admin.from('internal_alerts').insert({
          volunteer_id: volunteerId,
          assigned_to: rule.assigned_to,
          message: rule.alert_message,
          action_type: 'document_added',
        })
      ))
    }
  }

  revalidatePath(`/dashboard/volunteers/${volunteerId}`)
  return {}
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
