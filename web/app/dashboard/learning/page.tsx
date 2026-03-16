import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import LearningView from './LearningView'
import type { LearningModule, Lesson, QuizQuestion, LessonCompletion, Volunteer } from '@/types/database'

export const dynamic = 'force-dynamic'

export interface QuizQuestionRow extends QuizQuestion {
  options: string[]
}

export interface LessonWithQuiz extends Lesson {
  quiz_questions: QuizQuestionRow[]
  completion_count: number
}

export interface ModuleWithLessons extends LearningModule {
  lessons: LessonWithQuiz[]
  completion_count: number
  total_volunteers: number
}

async function fetchLearningData() {
  noStore()
  const supabase = createAdminClient()

  const [
    { data: modules },
    { data: lessons },
    { data: quizQuestions },
    { data: completions },
    { data: volunteers },
  ] = await Promise.all([
    supabase.from('learning_modules').select('*').order('order_index', { ascending: true }),
    supabase.from('lessons').select('*').order('order_index', { ascending: true }),
    supabase.from('quiz_questions').select('*'),
    supabase.from('lesson_completions').select('*'),
    supabase.from('volunteers').select('id, first_name, last_name, category, status').eq('status', 'active'),
  ])

  const moduleList = modules ?? []
  const lessonList = lessons ?? []
  const qList = quizQuestions ?? []
  const completionList = completions ?? []
  const volunteerList = volunteers ?? []

  const totalVolunteers = volunteerList.length

  const result: ModuleWithLessons[] = moduleList.map(mod => {
    const modLessons = lessonList.filter(l => l.module_id === mod.id)

    // Count distinct volunteers who completed ALL lessons in this module
    const lessonIds = modLessons.map(l => l.id)
    const completedByVol: Record<string, Set<string>> = {}
    for (const c of completionList) {
      if (lessonIds.includes(c.lesson_id)) {
        if (!completedByVol[c.volunteer_id]) completedByVol[c.volunteer_id] = new Set()
        completedByVol[c.volunteer_id].add(c.lesson_id)
      }
    }
    const moduleCompletions = lessonIds.length === 0 ? 0 :
      Object.values(completedByVol).filter(s => s.size === lessonIds.length).length

    return {
      ...mod,
      required_for_categories: (mod.required_for_categories as string[]) ?? [],
      completion_count: moduleCompletions,
      total_volunteers: totalVolunteers,
      lessons: modLessons.map(lesson => ({
        ...lesson,
        quiz_questions: qList
          .filter(q => q.lesson_id === lesson.id)
          .map(q => ({ ...q, options: (q.options as string[]) ?? [] })),
        completion_count: completionList.filter(c => c.lesson_id === lesson.id).length,
      })),
    }
  })

  return { modules: result, volunteers: volunteerList }
}

export default async function LearningPage() {
  const { modules, volunteers } = await fetchLearningData()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '28px 32px 20px',
        borderBottom: '1px solid #f0f0f0',
        background: 'white',
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
          Learning
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>
          Build training modules and track volunteer progress
        </p>
      </div>

      <LearningView initialModules={modules} totalVolunteers={volunteers.length} />
    </div>
  )
}
