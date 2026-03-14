'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getVolunteerId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: volunteer } = await supabase
    .from('volunteers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) throw new Error('Volunteer not found')
  return { supabase, volunteerId: volunteer.id as string }
}

export async function completeLesson(
  lessonId: string,
  score?: number,
  timeSpentSeconds?: number
): Promise<void> {
  const { supabase, volunteerId } = await getVolunteerId()

  // Upsert so re-taking a quiz updates score
  const { error } = await supabase
    .from('lesson_completions')
    .upsert(
      {
        volunteer_id: volunteerId,
        lesson_id: lessonId,
        completed_at: new Date().toISOString(),
        score: score ?? null,
        time_spent_seconds: timeSpentSeconds ?? null,
      },
      { onConflict: 'volunteer_id,lesson_id' }
    )

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/learn')
}
