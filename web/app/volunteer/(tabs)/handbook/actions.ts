'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function signHandbook(
  volunteerId: string,
  fullName: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()

  // Verify this volunteer belongs to the current user
  const { data: vol } = await admin
    .from('volunteers')
    .select('id')
    .eq('id', volunteerId)
    .eq('user_id', user.id)
    .single()

  if (!vol) return { error: 'Permission denied.' }

  const { error } = await admin
    .from('volunteers')
    .update({
      handbook_signed_at: new Date().toISOString(),
      handbook_signed_name: fullName.trim(),
    })
    .eq('id', volunteerId)

  if (error) return { error: error.message }

  revalidatePath('/volunteer/handbook')
  return {}
}
