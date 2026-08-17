'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { VolunteerCategory, ApplicationFormField, ApplicationFieldAnswer, CommunicationPreference } from '@/types/database'

export interface ApplicationInput {
  first_name: string
  last_name: string
  email: string
  phone: string
  categories: string[]
  message: string
  communication_preference: CommunicationPreference
  custom: Record<string, string | string[]>
  /** Honeypot — hidden field humans never fill. Bots that do are dropped. */
  website?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COMM_PREFS: CommunicationPreference[] = ['email', 'phone', 'both']

// Best-effort abuse guard: this route has no auth guard by design (public
// application form), so it's rate-limited by IP against recent submissions
// instead. DB-backed rather than in-memory so it holds across serverless
// instances.
const RATE_LIMIT_WINDOW_MINUTES = 10
const RATE_LIMIT_MAX_SUBMISSIONS = 3

async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}

function resolveFieldOptions(field: ApplicationFormField, ctx: { tagNames: string[]; categoryNames: string[]; automationValues: string[] }): string[] {
  if (field.field_type === 'text') return []
  if (field.option_source === 'tags') return ctx.tagNames
  if (field.option_source === 'categories') return ctx.categoryNames
  if (field.option_source === 'automations') return ctx.automationValues
  return field.options
}

export async function submitApplication(input: ApplicationInput): Promise<{ error?: string }> {
  // Honeypot tripped: pretend success, store nothing.
  if (input.website && input.website.trim() !== '') return {}

  const firstName = input.first_name.trim()
  const lastName = input.last_name.trim()
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()
  const message = input.message.trim()
  const categories = [...new Set(input.categories.map(c => c.trim()).filter(Boolean))]

  if (!firstName || firstName.length > 100) return { error: 'Please enter your first name.' }
  if (!lastName || lastName.length > 100) return { error: 'Please enter your last name.' }
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: 'Please enter a valid email address.' }
  if (phone.length > 30) return { error: 'Please enter a valid phone number.' }
  if (message.length > 2000) return { error: 'Message must be under 2000 characters.' }
  if (categories.length === 0) return { error: 'Please select at least one category of interest.' }
  if (!COMM_PREFS.includes(input.communication_preference)) return { error: 'Please choose a communication preference.' }

  const admin = createAdminClient()

  // Resolve org (single-org setup — use first row)
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) return { error: 'Organization not found.' }

  // Rate limit by IP within the org
  const ip = await getClientIp()
  if (ip !== 'unknown') {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
    const { count } = await admin
      .from('application_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('ip_address', ip)
      .gte('created_at', since)
    if ((count ?? 0) >= RATE_LIMIT_MAX_SUBMISSIONS) {
      return { error: 'Too many submissions from this connection. Please try again later.' }
    }
  }

  // Categories must all be active configured categories
  const { data: categoryRows } = await admin
    .from('categories')
    .select('slug, name')
    .eq('is_archived', false)
  const validSlugs = new Set((categoryRows ?? []).map(c => c.slug))
  if (!categories.every(c => validSlugs.has(c))) return { error: 'Please choose a valid category.' }

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

  // Latest live application form (may not exist yet if never configured)
  const { data: formVersion } = await admin
    .from('application_form_versions')
    .select('id, fields')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const fields = (formVersion?.fields ?? []) as ApplicationFormField[]
  const customResponses: Record<string, ApplicationFieldAnswer> = {}

  if (fields.length > 0) {
    const [{ data: tags }, { data: rules }] = await Promise.all([
      admin.from('org_tags').select('name').eq('org_id', org.id),
      admin.from('form_automation_rules').select('field_value').eq('org_id', org.id),
    ])
    const ctx = {
      tagNames: (tags ?? []).map(t => t.name),
      categoryNames: (categoryRows ?? []).map(c => c.name),
      automationValues: Array.from(new Set((rules ?? []).map(r => r.field_value))),
    }

    for (const field of fields) {
      const raw = input.custom[field.id]
      const options = resolveFieldOptions(field, ctx)

      if (field.field_type === 'text') {
        const value = typeof raw === 'string' ? raw.trim() : ''
        if (field.required && !value) return { error: `Please fill out "${field.label}".` }
        if (value.length > 1000) return { error: `"${field.label}" must be under 1000 characters.` }
        if (value) customResponses[field.id] = { label: field.label, field_type: field.field_type, value }
      } else if (field.field_type === 'dropdown') {
        const value = typeof raw === 'string' ? raw.trim() : ''
        if (field.required && !value) return { error: `Please choose an option for "${field.label}".` }
        if (value && !options.includes(value)) return { error: `Invalid choice for "${field.label}".` }
        if (value) customResponses[field.id] = { label: field.label, field_type: field.field_type, value }
      } else {
        const values = Array.isArray(raw) ? raw.filter(Boolean) : []
        if (field.required && values.length === 0) return { error: `Please select at least one option for "${field.label}".` }
        if (!values.every(v => options.includes(v))) return { error: `Invalid choice for "${field.label}".` }
        if (values.length > 0) customResponses[field.id] = { label: field.label, field_type: field.field_type, value: values }
      }
    }
  }

  const { data: newVol, error } = await admin.from('volunteers').insert({
    org_id: org.id,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: phone || null,
    category: categories[0] as VolunteerCategory,
    volunteer_categories: categories,
    communication_preference: input.communication_preference,
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

  // Record custom-field answers, self-describing so they stay readable if
  // the field is later renamed or removed from the live form.
  if (Object.keys(customResponses).length > 0) {
    await admin.from('application_submissions').insert({
      org_id: org.id,
      volunteer_id: newVol.id,
      form_version_id: formVersion?.id ?? null,
      responses: customResponses,
      ip_address: ip !== 'unknown' ? ip : null,
    })
  }

  // Evaluate form automation rules (category-based only, as configured today)
  const { data: rules } = await admin
    .from('form_automation_rules')
    .select('*')
    .eq('org_id', org.id)

  if (rules && rules.length > 0) {
    const formData: Record<string, string> = { category: categories[0] }
    for (const rule of rules) {
      if (!(rule.field_key in formData) || formData[rule.field_key] !== rule.field_value) continue
      if (rule.action_type === 'assign_category') {
        const allCats = [...new Set([...categories, rule.action_value])]
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
