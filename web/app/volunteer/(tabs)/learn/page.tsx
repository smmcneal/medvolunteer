import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LearnView from './LearnView'
import type { VolunteerCategory } from '@/types/database'

export type ModuleWithLessons = {
  id: string
  title: string
  description: string | null
  order_index: number
  is_required: boolean
  lessons: LessonWithQuestions[]
}

export type LessonWithQuestions = {
  id: string
  module_id: string
  title: string
  type: 'video' | 'text' | 'quiz'
  content_url: string | null
  content_text: string | null
  duration_minutes: number | null
  order_index: number
  questions: QuizQuestionRow[]
  completion: { completed_at: string; score: number | null } | null
}

export type QuizQuestionRow = {
  id: string
  question: string
  options: string[]
  correct_answer_index: number
  order_index: number
}

export default async function LearnPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/volunteer/login')

  const { data: volunteer } = await supabase
    .from('volunteers')
    .select('id, category')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) redirect('/volunteer/login')

  const category = volunteer.category as VolunteerCategory

  // Fetch active modules relevant to this volunteer's category
  const { data: modules } = await supabase
    .from('learning_modules')
    .select('id, title, description, order_index, is_required, required_for_categories')
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  const relevantModules = (modules ?? []).filter(m => {
    const cats = m.required_for_categories as VolunteerCategory[]
    return cats.length === 0 || cats.includes(category)
  })

  const moduleIds = relevantModules.map(m => m.id)

  if (moduleIds.length === 0) {
    return <LearnView modules={[]} volunteerId={volunteer.id} />
  }

  // Fetch lessons + quiz questions + completions in parallel
  const [lessonsResult, questionsResult, completionsResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, module_id, title, type, content_url, content_text, duration_minutes, order_index')
      .in('module_id', moduleIds)
      .eq('is_active', true)
      .order('order_index', { ascending: true }),

    supabase
      .from('quiz_questions')
      .select('id, lesson_id, question, options, correct_answer_index, order_index')
      .order('order_index', { ascending: true }),

    supabase
      .from('lesson_completions')
      .select('lesson_id, completed_at, score')
      .eq('volunteer_id', volunteer.id),
  ])

  const lessons = lessonsResult.data ?? []
  const questions = questionsResult.data ?? []
  const completions = completionsResult.data ?? []

  // Build completion map keyed by lesson_id
  const completionMap = new Map(
    completions.map(c => [c.lesson_id, { completed_at: c.completed_at, score: c.score }])
  )

  // Build questions map keyed by lesson_id
  const questionsMap = new Map<string, QuizQuestionRow[]>()
  for (const q of questions) {
    const lessonId = (q as { lesson_id: string }).lesson_id
    if (!questionsMap.has(lessonId)) questionsMap.set(lessonId, [])
    questionsMap.get(lessonId)!.push(q as QuizQuestionRow)
  }

  // Assemble final structure
  const assembled: ModuleWithLessons[] = relevantModules.map(mod => ({
    id: mod.id,
    title: mod.title,
    description: mod.description,
    order_index: mod.order_index,
    is_required: mod.is_required,
    lessons: lessons
      .filter(l => l.module_id === mod.id)
      .map(l => ({
        id: l.id,
        module_id: l.module_id,
        title: l.title,
        type: l.type as 'video' | 'text' | 'quiz',
        content_url: l.content_url,
        content_text: l.content_text,
        duration_minutes: l.duration_minutes,
        order_index: l.order_index,
        questions: questionsMap.get(l.id) ?? [],
        completion: completionMap.get(l.id) ?? null,
      })),
  }))

  return <LearnView modules={assembled} volunteerId={volunteer.id} />
}
