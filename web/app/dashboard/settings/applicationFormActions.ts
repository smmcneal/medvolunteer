'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ApplicationFormField, ApplicationFieldType, ApplicationOptionSource } from '@/types/database'

const FIELD_TYPES: ApplicationFieldType[] = ['text', 'dropdown', 'checkbox']
const OPTION_SOURCES: ApplicationOptionSource[] = ['manual', 'tags', 'categories', 'automations']

export interface ApplicationFormFieldInput {
  id?: string
  label: string
  field_type: ApplicationFieldType
  option_source: ApplicationOptionSource
  options: string[]
  required: boolean
}

function normalizeFields(input: ApplicationFormFieldInput[]): ApplicationFormField[] {
  return input.map((f, i) => {
    const label = f.label.trim()
    if (!label) throw new Error('Every field needs a label.')
    if (!FIELD_TYPES.includes(f.field_type)) throw new Error('Invalid field type.')
    if (!OPTION_SOURCES.includes(f.option_source)) throw new Error('Invalid option source.')

    const needsOptions = f.field_type === 'dropdown' || f.field_type === 'checkbox'
    const options = needsOptions && f.option_source === 'manual'
      ? f.options.map(o => o.trim()).filter(Boolean)
      : []
    if (needsOptions && f.option_source === 'manual' && options.length === 0) {
      throw new Error(`"${label}" needs at least one choice.`)
    }

    return {
      id: f.id ?? crypto.randomUUID(),
      label,
      field_type: f.field_type,
      option_source: needsOptions ? f.option_source : 'manual',
      options,
      required: !!f.required,
      sort_order: i,
    }
  })
}

export async function saveApplicationForm(fields: ApplicationFormFieldInput[]): Promise<{ error?: string }> {
  const user = await requireAdmin()
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) return { error: 'Organization not found.' }

  let normalized: ApplicationFormField[]
  try {
    normalized = normalizeFields(fields)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid field configuration.' }
  }

  const { error } = await admin.from('application_form_versions').insert({
    org_id: org.id,
    fields: normalized,
    created_by: user.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  revalidatePath('/apply')
  return {}
}

export async function restoreApplicationFormVersion(versionId: string): Promise<{ error?: string }> {
  const user = await requireAdmin()
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) return { error: 'Organization not found.' }

  const { data: version } = await admin
    .from('application_form_versions')
    .select('fields')
    .eq('id', versionId)
    .eq('org_id', org.id)
    .maybeSingle()
  if (!version) return { error: 'Version not found.' }

  const { error } = await admin.from('application_form_versions').insert({
    org_id: org.id,
    fields: version.fields,
    created_by: user.id,
    restored_from: versionId,
  })
  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  revalidatePath('/apply')
  return {}
}
