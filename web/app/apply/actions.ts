'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface ApplicationInput {
  first_name: string
  last_name: string
  email: string
  phone: string
  category: string
  message: string
}

export async function submitApplication(input: ApplicationInput): Promise<{ error?: string }> {
  const admin = createAdminClient()

  // Resolve org (single-org setup — use first row)
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) return { error: 'Organization not found.' }

  // Check for duplicate email
  const { data: existing } = await admin
    .from('volunteers')
    .select('id')
    .eq('email', input.email.trim().toLowerCase())
    .maybeSingle()
  if (existing) return { error: 'An application with this email already exists.' }

  const { error } = await admin.from('volunteers').insert({
    org_id: org.id,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim() || null,
    category: input.category as any,
    status: 'applicant',
    pipeline_phase: 'intake',
    user_id: null,
    // Store the message as a note — will be created after volunteer insert
  })

  if (error) return { error: error.message }

  // Add the message as the first note if provided
  if (input.message.trim()) {
    const { data: volunteer } = await admin
      .from('volunteers')
      .select('id')
      .eq('email', input.email.trim().toLowerCase())
      .single()

    if (volunteer) {
      await admin.from('volunteer_notes').insert({
        volunteer_id: volunteer.id,
        content: `Application message: ${input.message.trim()}`,
        created_by: null,
      })
    }
  }

  revalidatePath('/dashboard/volunteers')
  return {}
}
