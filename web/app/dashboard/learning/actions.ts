'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Modules ──────────────────────────────────────────────────────────────────

export async function createModule(data: {
  title: string
  description: string
  is_required: boolean
  required_for_categories: string[]
}) {
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single()

  if (!org) throw new Error('No organization found')

  const { data: maxOrder } = await supabase
    .from('learning_modules')
    .select('order_index')
    .eq('org_id', org.id)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('learning_modules').insert({
    org_id: org.id,
    title: data.title,
    description: data.description,
    is_required: data.is_required,
    required_for_categories: data.required_for_categories,
    order_index: (maxOrder?.order_index ?? -1) + 1,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/learning')
}

export async function updateModule(id: string, data: {
  title?: string
  description?: string
  is_required?: boolean
  required_for_categories?: string[]
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('learning_modules').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/learning')
}

export async function deleteModule(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('learning_modules').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/learning')
}

export async function reorderModules(ids: string[]) {
  const supabase = await createClient()
  await Promise.all(
    ids.map((id, index) =>
      supabase.from('learning_modules').update({ order_index: index }).eq('id', id)
    )
  )
  revalidatePath('/dashboard/learning')
}

// ─── Lessons ──────────────────────────────────────────────────────────────────

export async function createLesson(data: {
  module_id: string
  title: string
  type: 'video' | 'text' | 'quiz'
  content_url: string | null
  duration_minutes: number | null
}) {
  const supabase = await createClient()

  const { data: maxOrder } = await supabase
    .from('lessons')
    .select('order_index')
    .eq('module_id', data.module_id)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('lessons').insert({
    ...data,
    order_index: (maxOrder?.order_index ?? -1) + 1,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/learning')
}

export async function updateLesson(id: string, data: {
  title?: string
  type?: 'video' | 'text' | 'quiz'
  content_url?: string | null
  duration_minutes?: number | null
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('lessons').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/learning')
}

export async function deleteLesson(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('lessons').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/learning')
}

export async function reorderLessons(ids: string[]) {
  const supabase = await createClient()
  await Promise.all(
    ids.map((id, index) =>
      supabase.from('lessons').update({ order_index: index }).eq('id', id)
    )
  )
  revalidatePath('/dashboard/learning')
}

// ─── Quiz Questions ────────────────────────────────────────────────────────────

export async function createQuizQuestion(data: {
  lesson_id: string
  question: string
  options: string[]
  correct_answer_index: number
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('quiz_questions').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/learning')
}

export async function updateQuizQuestion(id: string, data: {
  question?: string
  options?: string[]
  correct_answer_index?: number
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('quiz_questions').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/learning')
}

export async function deleteQuizQuestion(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('quiz_questions').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/learning')
}
