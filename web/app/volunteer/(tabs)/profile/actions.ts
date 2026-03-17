'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const BUCKET = 'volunteer-documents'

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadVolunteerDocument(
  formData: FormData,
): Promise<{ error?: string }> {
  const file       = formData.get('file') as File | null
  const volunteerId = formData.get('volunteerId') as string | null

  if (!file || !volunteerId) return { error: 'Missing file or volunteer ID.' }
  if (file.size > 52_428_800)  return { error: 'File must be under 50 MB.' }

  const admin = createAdminClient()

  // Create bucket if it doesn't exist yet
  const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
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
  if (bucketError && !bucketError.message.toLowerCase().includes('already exists')) {
    return { error: bucketError.message }
  }

  const ext      = file.name.includes('.') ? file.name.split('.').pop() : ''
  const safeName = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
  const path     = `${volunteerId}/${safeName}`

  const bytes = await file.arrayBuffer()
  const { error: storageError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (storageError) return { error: storageError.message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error: dbError } = await admin.from('volunteer_uploads').insert({
    volunteer_id: volunteerId,
    name:         file.name,
    mime_type:    file.type || 'application/octet-stream',
    size_bytes:   file.size,
    storage_path: path,
    uploaded_by:  user?.id ?? null,
  })

  if (dbError) {
    await admin.storage.from(BUCKET).remove([path])
    return { error: dbError.message }
  }

  revalidatePath('/volunteer/profile')
  return {}
}

// ─── Upload credential document ───────────────────────────────────────────────

export async function uploadCredentialFile(
  formData: FormData,
): Promise<{ error?: string }> {
  const file        = formData.get('file') as File | null
  const volunteerId = formData.get('volunteerId') as string | null

  if (!file || !volunteerId) return { error: 'Missing file or volunteer ID.' }
  if (file.size > 52_428_800)  return { error: 'File must be under 50 MB.' }

  // Verify caller owns this volunteer record
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()
  const { data: vol } = await admin
    .from('volunteers')
    .select('id')
    .eq('id', volunteerId)
    .eq('user_id', user.id)
    .single()
  if (!vol) return { error: 'Permission denied.' }

  const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
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
  if (bucketError && !bucketError.message.toLowerCase().includes('already exists')) {
    return { error: bucketError.message }
  }

  const ext      = file.name.includes('.') ? file.name.split('.').pop() : ''
  const safeName = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
  const path     = `${volunteerId}/${safeName}`

  const bytes = await file.arrayBuffer()
  const { error: storageError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (storageError) return { error: storageError.message }

  const { error: dbError } = await admin.from('volunteer_uploads').insert({
    volunteer_id: volunteerId,
    name:         file.name,
    mime_type:    file.type || 'application/octet-stream',
    size_bytes:   file.size,
    storage_path: path,
    uploaded_by:  user.id,
    category:     'credential',
  })

  if (dbError) {
    await admin.storage.from(BUCKET).remove([path])
    return { error: dbError.message }
  }

  revalidatePath('/volunteer/profile')
  return {}
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteVolunteerUpload(
  uploadId: string,
  storagePath: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  await admin.storage.from(BUCKET).remove([storagePath])
  const { error } = await admin.from('volunteer_uploads').delete().eq('id', uploadId)
  if (error) return { error: error.message }
  revalidatePath('/volunteer/profile')
  return {}
}

// ─── Update contact info ──────────────────────────────────────────────────────

export async function updateContactInfo(
  volunteerId: string,
  email: string,
  phone: string,
): Promise<{ error?: string }> {
  const emailTrimmed = email.trim().toLowerCase()
  const phoneTrimmed = phone.trim()

  if (!emailTrimmed) return { error: 'Email is required.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) return { error: 'Enter a valid email address.' }

  // Verify the caller owns this volunteer record
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()

  // Confirm user_id matches
  const { data: vol } = await admin
    .from('volunteers')
    .select('id')
    .eq('id', volunteerId)
    .eq('user_id', user.id)
    .single()

  if (!vol) return { error: 'Permission denied.' }

  const { error } = await admin
    .from('volunteers')
    .update({ email: emailTrimmed, phone: phoneTrimmed || null })
    .eq('id', volunteerId)

  if (error) return { error: error.message }
  revalidatePath('/volunteer/profile')
  return {}
}

// ─── Update emergency contact ─────────────────────────────────────────────────

export async function updateEmergencyContact(
  volunteerId: string,
  name: string,
  phone: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()

  const { data: vol } = await admin
    .from('volunteers')
    .select('id')
    .eq('id', volunteerId)
    .eq('user_id', user.id)
    .single()

  if (!vol) return { error: 'Permission denied.' }

  const { error } = await admin
    .from('volunteers')
    .update({
      emergency_contact_name:  name.trim()  || null,
      emergency_contact_phone: phone.trim() || null,
    })
    .eq('id', volunteerId)

  if (error) return { error: error.message }
  revalidatePath('/volunteer/profile')
  return {}
}

// ─── Signed URL ───────────────────────────────────────────────────────────────

export async function getUploadSignedUrl(
  storagePath: string,
): Promise<{ url?: string; error?: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
