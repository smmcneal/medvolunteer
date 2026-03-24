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

  const { data: newVol, error } = await admin.from('volunteers').insert({
    org_id: org.id,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim() || null,
    category: input.category as any,
    status: 'applicant',
    pipeline_phase: 'intake',
    user_id: null,
  }).select('id').single()

  if (error || !newVol) return { error: error?.message ?? 'Failed to submit application.' }

  // Add the message as the first note if provided
  if (input.message.trim()) {
    await admin.from('volunteer_notes').insert({
      volunteer_id: newVol.id,
      content: `Application message: ${input.message.trim()}`,
      created_by: null,
    })
  }

  // Evaluate form automation rules
  const { data: rules } = await admin
    .from('form_automation_rules')
    .select('*')
    .eq('org_id', org.id)

  if (rules && rules.length > 0) {
    const formData: Record<string, string> = { category: input.category }
    for (const rule of rules) {
      if (!(rule.field_key in formData) || formData[rule.field_key] !== rule.field_value) continue
      if (rule.action_type === 'assign_category') {
        const allCats = [input.category, rule.action_value]
        await admin.from('volunteers').update({
          volunteer_categories: allCats,
        }).eq('id', newVol.id)
      } else if (rule.action_type === 'assign_flag') {
        await admin.from('volunteer_flags').insert({
          volunteer_id: newVol.id,
          flag_id: rule.action_value,
          notes: 'Auto-assigned by form automation',
        })
      } else if (rule.action_type === 'assign_tag') {
        await admin.from('volunteer_tags').insert({
          volunteer_id: newVol.id,
          tag_id: rule.action_value,
        })
      }
    }
  }

  revalidatePath('/dashboard/volunteers')
  return {}
}
