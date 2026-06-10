'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireVolunteer } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/** Marks a non-quiz lesson (video/text) complete. Quiz lessons go through gradeQuiz. */
export async function completeLesson(
  lessonId: string,
  timeSpentSeconds?: number
): Promise<void> {
  const { volunteerId } = await requireVolunteer()
  const admin = createAdminClient()

  // Quizzes must be graded server-side — reject client-claimed completions
  const { data: lesson } = await admin
    .from('lessons')
    .select('id, type')
    .eq('id', lessonId)
    .single()
  if (!lesson) throw new Error('Lesson not found')
  if (lesson.type === 'quiz') throw new Error('Quiz lessons are completed by submitting answers')

  const { error } = await admin
    .from('lesson_completions')
    .upsert(
      {
        volunteer_id: volunteerId,
        lesson_id: lessonId,
        completed_at: new Date().toISOString(),
        score: null,
        time_spent_seconds: timeSpentSeconds ?? null,
      },
      { onConflict: 'volunteer_id,lesson_id' }
    )

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/learn')
}

export interface QuizGradeResult {
  score: number
  correctIndexes: Record<string, number>
}

/**
 * Grades a quiz on the server. Correct answers never reach the client before
 * submission — the page omits correct_answer_index, and the score recorded
 * here is computed from the submitted answers, not trusted from the client.
 */
export async function gradeQuiz(
  lessonId: string,
  answers: { questionId: string; answerIndex: number | null }[],
  timeSpentSeconds?: number,
): Promise<QuizGradeResult> {
  const { volunteerId } = await requireVolunteer()
  const admin = createAdminClient()

  const { data: questions, error: qErr } = await admin
    .from('quiz_questions')
    .select('id, correct_answer_index')
    .eq('lesson_id', lessonId)

  if (qErr) throw new Error(qErr.message)
  if (!questions || questions.length === 0) throw new Error('No questions for this lesson')

  const answerMap = new Map(answers.map(a => [a.questionId, a.answerIndex]))
  let correct = 0
  const correctIndexes: Record<string, number> = {}

  for (const q of questions) {
    correctIndexes[q.id] = q.correct_answer_index
    if (answerMap.get(q.id) === q.correct_answer_index) correct++
  }

  const score = Math.round((correct / questions.length) * 100)

  const { error } = await admin
    .from('lesson_completions')
    .upsert(
      {
        volunteer_id: volunteerId,
        lesson_id: lessonId,
        completed_at: new Date().toISOString(),
        score,
        time_spent_seconds: timeSpentSeconds ?? null,
      },
      { onConflict: 'volunteer_id,lesson_id' }
    )

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/learn')
  return { score, correctIndexes }
}
