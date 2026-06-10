'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { VolunteerCategory } from '@/types/database'

export interface ApplicationInput {
  first_name: string
  last_name: string
  email: string
  phone: string
  category: string
  message: string
  /** Honeypot — hidden field humans never fill. Bots that do are dropped. */
  website?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function submitApplication(input: ApplicationInput): Promise<{ error?: string }> {
  // Honeypot tripped: pretend success, store nothing.
  if (input.website && input.website.trim() !== '') return {}

  const firstName = input.first_name.trim()
  const lastName = input.last_name.trim()
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()
  const message = input.message.trim()

  if (!firstName || firstName.length > 100) return { error: 'Please enter your first name.' }
  if (!lastName || lastName.length > 100) return { error: 'Please enter your last name.' }
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: 'Please enter a valid email address.' }
  if (phone.length > 30) return { error: 'Please enter a valid phone number.' }
  if (message.length > 2000) return { error: 'Message must be under 2000 characters.' }

  const admin = createAdminClient()

  // Resolve org (single-org setup — use first row)
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) return { error: 'Organization not found.' }

  // Category must be one of the active configured categories
  const { data: categories } = await admin
    .from('categories')
    .select('slug')
    .eq('is_archived', false)
  const validSlugs = new Set((categories ?? []).map(c => c.slug))
  if (!validSlugs.has(input.category)) return { error: 'Please choose a valid category.' }

  // Check for duplicate email. Respond with success-shaped messaging rather
  // than confirming the address exists to anonymous callers.
  const { data: existing } = await admin
    .from('volunteers')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existing) {
    return { error: 'We could not submit this application. If you have already applied, the team has your information — no need to apply again.' }
  }

  const { data: newVol, error } = await admin.from('volunteers').insert({
    org_id: org.id,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: phone || null,
    category: input.category as VolunteerCategory,
    status: 'applicant',
    pipeline_phase: 'intake',
    user_id: null,
  }).select('id').single()

  if (error || !newVol) return { error: 'Failed to submit application. Please try again.' }

  // Add the message as the first note if provided
  if (message) {
    await admin.from('volunteer_notes').insert({
      volunteer_id: newVol.id,
      content: `Application message: ${message}`,
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
