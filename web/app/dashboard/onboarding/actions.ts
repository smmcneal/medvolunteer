'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { StageType, VolunteerCategory } from '@/types/database'

// ─── Workflows ────────────────────────────────────────────────────────────────

export async function createWorkflow(data: {
  name: string
  applies_to_category: VolunteerCategory | null
}) {
  const supabase = await createClient()

  // Get org_id from the first organization (single-org MVP)
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single()

  if (!org) throw new Error('No organization found')

  const { error } = await supabase.from('onboarding_workflows').insert({
    org_id: org.id,
    name: data.name,
    applies_to_category: data.applies_to_category,
    is_active: true,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/onboarding')
}

export async function updateWorkflow(id: string, data: {
  name?: string
  applies_to_category?: VolunteerCategory | null
  is_active?: boolean
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('onboarding_workflows')
    .update(data)
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/onboarding')
}

export async function deleteWorkflow(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('onboarding_workflows')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/onboarding')
}

// ─── Stages ───────────────────────────────────────────────────────────────────

export async function createStage(data: {
  workflow_id: string
  name: string
  description: string
  stage_type: StageType
  is_required: boolean
  deadline_days_after_start: number | null
  order_index: number
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('onboarding_stages').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/onboarding')
}

export async function updateStage(id: string, data: {
  name?: string
  description?: string
  stage_type?: StageType
  is_required?: boolean
  deadline_days_after_start?: number | null
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('onboarding_stages')
    .update(data)
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/onboarding')
}

export async function deleteStage(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('onboarding_stages')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/onboarding')
}

export async function reorderStages(stages: { id: string; order_index: number }[]) {
  const supabase = await createClient()

  // Batch update order_index for each stage
  await Promise.all(
    stages.map(s =>
      supabase
        .from('onboarding_stages')
        .update({ order_index: s.order_index })
        .eq('id', s.id)
    )
  )

  revalidatePath('/dashboard/onboarding')
}
