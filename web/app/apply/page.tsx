import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import ApplyForm from './ApplyForm'
import type { ApplicationFormField } from '@/types/database'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Volunteer Application — MedVolunteer',
  description: 'Apply to join our volunteer team.',
}

export interface ResolvedApplicationField extends ApplicationFormField {
  resolvedOptions: string[]
}

async function fetchFormData() {
  noStore()
  const admin = createAdminClient()

  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) return { categories: [] as { slug: string; name: string }[], fields: [] as ResolvedApplicationField[] }

  const [{ data: categories }, { data: tags }, { data: rules }, { data: versionRow }] = await Promise.all([
    admin.from('categories').select('slug, name').eq('is_archived', false).order('sort_order'),
    admin.from('org_tags').select('name').eq('org_id', org.id).order('name'),
    admin.from('form_automation_rules').select('field_value').eq('org_id', org.id),
    admin.from('application_form_versions').select('fields').eq('org_id', org.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const tagNames = (tags ?? []).map(t => t.name)
  const categoryNames = (categories ?? []).map(c => c.name)
  const automationValues = Array.from(new Set((rules ?? []).map(r => r.field_value)))

  const rawFields = (versionRow?.fields ?? []) as ApplicationFormField[]
  const fields: ResolvedApplicationField[] = [...rawFields]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(f => ({
      ...f,
      resolvedOptions:
        f.field_type === 'text' ? [] :
        f.option_source === 'manual' ? f.options :
        f.option_source === 'tags' ? tagNames :
        f.option_source === 'categories' ? categoryNames :
        automationValues,
    }))

  return {
    categories: (categories ?? []) as { slug: string; name: string }[],
    fields,
  }
}

export default async function ApplyPage() {
  const { categories, fields } = await fetchFormData()
  return <ApplyForm categories={categories} customFields={fields} />
}
