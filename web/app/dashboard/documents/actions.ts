'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const BUCKET = 'org-documents'

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadOrgDocument(
  formData: FormData,
): Promise<{ error?: string }> {
  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided.' }
  if (file.size > 52_428_800) return { error: 'File must be under 50 MB.' }

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

  const bytes = await file.arrayBuffer()
  const { error: storageError } = await admin.storage
    .from(BUCKET)
    .upload(safeName, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (storageError) return { error: storageError.message }

  const { error: dbError } = await admin.from('org_documents').insert({
    name:         file.name,
    storage_path: safeName,
    mime_type:    file.type || 'application/octet-stream',
    size_bytes:   file.size,
    is_preset:    false,
  })

  if (dbError) {
    await admin.storage.from(BUCKET).remove([safeName])
    return { error: dbError.message }
  }

  revalidatePath('/dashboard/documents')
  revalidatePath('/volunteer/documents')
  return {}
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteOrgDocument(
  id: string,
  storagePath: string | null,
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  if (storagePath) {
    await admin.storage.from(BUCKET).remove([storagePath])
  }

  const { error } = await admin.from('org_documents').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/documents')
  revalidatePath('/volunteer/documents')
  return {}
}

// ─── Signed URL ───────────────────────────────────────────────────────────────

export async function getOrgDocumentSignedUrl(
  storagePath: string,
): Promise<{ url?: string; error?: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600) // 1-hour expiry

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
