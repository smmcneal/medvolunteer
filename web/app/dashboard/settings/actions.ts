'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── Org Profile ──────────────────────────────────────────────────────────────

export async function updateOrgProfile(data: {
  name: string
  logo_url: string | null
}) {
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { error } = await admin.from('organizations').update(data).eq('id', org.id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

export async function updateOrgSettings(settings: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id, settings').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { error } = await admin
    .from('organizations')
    .update({ settings: { ...(org.settings as Record<string, unknown> ?? {}), ...settings } })
    .eq('id', org.id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

// ─── Locations ────────────────────────────────────────────────────────────────

export async function createLocation(data: {
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  geofence_radius_meters: number
}) {
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { error } = await admin.from('locations').insert({ org_id: org.id, ...data })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

export async function updateLocation(id: string, data: {
  name?: string
  address?: string | null
  lat?: number | null
  lng?: number | null
  geofence_radius_meters?: number
  is_active?: boolean
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('locations').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

export async function deleteLocation(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('locations').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

// ─── Holidays ─────────────────────────────────────────────────────────────────

export async function addHoliday(data: { name: string; date: string; is_recurring: boolean }) {
  if (!data.name.trim()) throw new Error('Name cannot be empty')
  if (!data.date) throw new Error('Date cannot be empty')
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { error } = await admin
    .from('org_holidays')
    .insert({ org_id: org.id, name: data.name.trim(), date: data.date, is_recurring: data.is_recurring })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/shifts')
}

export async function deleteHoliday(holidayId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('org_holidays').delete().eq('id', holidayId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/shifts')
}

export async function bulkAddHolidays(holidays: { name: string; date: string; is_recurring: boolean }[]) {
  if (holidays.length === 0) return
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { data: existing } = await admin.from('org_holidays').select('date, name').eq('org_id', org.id)
  const existingKeys = new Set((existing ?? []).map(h => `${h.date}|${h.name}`))
  const toInsert = holidays
    .filter(h => !existingKeys.has(`${h.date}|${h.name}`))
    .map(h => ({ org_id: org.id, name: h.name, date: h.date, is_recurring: h.is_recurring }))
  if (toInsert.length === 0) return
  const { error } = await admin.from('org_holidays').insert(toInsert)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/shifts')
}

// ─── Form Automation ──────────────────────────────────────────────────────────

export async function saveFormAutomationRule(input: {
  fieldKey: string
  fieldValue: string
  actionType: 'assign_category' | 'assign_flag' | 'assign_tag'
  actionValue: string
}) {
  if (!input.fieldKey.trim() || !input.fieldValue.trim() || !input.actionValue.trim()) {
    throw new Error('All fields are required')
  }
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { error } = await admin.from('form_automation_rules').insert({
    org_id: org.id,
    field_key: input.fieldKey.trim(),
    field_value: input.fieldValue.trim(),
    action_type: input.actionType,
    action_value: input.actionValue.trim(),
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

export async function deleteFormAutomationRule(ruleId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('form_automation_rules').delete().eq('id', ruleId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

// ─── Auto Message Rules ───────────────────────────────────────────────────────

export async function saveAutoMessageRule(input: {
  name: string
  triggerType: string
  templateId: string
  daysBefore: number
  channel: string
}) {
  if (!input.name.trim()) throw new Error('Name is required')
  if (!input.templateId) throw new Error('Template is required')
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { error } = await admin.from('auto_message_rules').insert({
    org_id: org.id,
    name: input.name.trim(),
    trigger_type: input.triggerType,
    template_id: input.templateId,
    days_before: input.daysBefore,
    channel: input.channel,
    is_active: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

export async function deleteAutoMessageRule(ruleId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('auto_message_rules').delete().eq('id', ruleId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

export async function toggleAutoMessageRule(ruleId: string, isActive: boolean) {
  const admin = createAdminClient()
  const { error } = await admin.from('auto_message_rules').update({ is_active: isActive }).eq('id', ruleId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

// ─── Category Requirements ────────────────────────────────────────────────────

export async function addCategoryRequirement(data: {
  category_name: string
  title: string
  description?: string
  is_blocking?: boolean
}) {
  if (!data.title.trim()) throw new Error('Title cannot be empty')
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { data: newReq, error } = await admin.from('category_requirements').insert({
    org_id: org.id,
    category_name: data.category_name,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    is_blocking: data.is_blocking ?? false,
  }).select().single()
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
  return newReq
}

export async function deleteCategoryRequirement(reqId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('category_requirements').delete().eq('id', reqId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

// ─── Category Coordinators ────────────────────────────────────────────────────

export async function assignCategoryCoordinator(
  category: string,
  coordinatorVolunteerId: string,
) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('org_category_coordinators')
    .upsert({ category, coordinator_volunteer_id: coordinatorVolunteerId }, { onConflict: 'category' })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

export async function removeCategoryCoordinator(category: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('org_category_coordinators')
    .delete()
    .eq('category', category)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

// ─── Document Automation Rules ────────────────────────────────────────────────

export async function saveDocumentAutomationRule(data: {
  trigger_document_type: string
  alert_message: string
  assigned_to: string | null
}) {
  if (!data.trigger_document_type.trim() || !data.alert_message.trim()) throw new Error('Document type and message are required')
  const admin = createAdminClient()
  const { error } = await admin.from('document_automation_rules').insert({
    trigger_document_type: data.trigger_document_type.trim(),
    alert_message: data.alert_message.trim(),
    assigned_to: data.assigned_to || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

export async function deleteDocumentAutomationRule(ruleId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('document_automation_rules').delete().eq('id', ruleId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

// ─── Dynamic categories ───────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export async function addCategory(
  name: string,
  description: string,
): Promise<{ error?: string }> {
  if (!name.trim()) return { error: 'Category name is required.' }
  const admin = createAdminClient()
  const slug = slugify(name.trim())
  const { error } = await admin.from('categories').insert({
    slug,
    name: name.trim(),
    description: description.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return {}
}

export async function updateCategoryName(
  id: string,
  name: string,
): Promise<{ error?: string }> {
  if (!name.trim()) return { error: 'Category name is required.' }
  const admin = createAdminClient()
  const { error } = await admin.from('categories').update({ name: name.trim() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return {}
}

export async function updateCategoryDescription(
  id: string,
  description: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('categories').update({ description: description.trim() || null }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return {}
}

export async function archiveCategory(id: string): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('categories').update({ is_archived: true }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return {}
}

export async function restoreCategory(id: string): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('categories').update({ is_archived: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return {}
}

// ─── Category Descriptions ────────────────────────────────────────────────────

export async function updateCategoryDescriptions(descriptions: Record<string, string>) {
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id, settings').limit(1).single()
  if (!org) throw new Error('No organization found')
  const existing = (org.settings as Record<string, unknown>) ?? {}
  const { error } = await admin
    .from('organizations')
    .update({ settings: { ...existing, category_descriptions: descriptions } })
    .eq('id', org.id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}
