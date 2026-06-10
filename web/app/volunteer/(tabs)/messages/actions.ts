'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireVolunteer } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function markMessageRead(recipientId: string): Promise<void> {
  const { volunteerId } = await requireVolunteer()
  const admin = createAdminClient()

  // Verify ownership before updating
  const { data: recipient } = await admin
    .from('message_recipients')
    .select('id, volunteer_id')
    .eq('id', recipientId)
    .single()

  if (!recipient || recipient.volunteer_id !== volunteerId) throw new Error('Not found or access denied')

  const { error } = await admin
    .from('message_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('id', recipientId)
    .is('read_at', null) // no-op if already read

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/messages')
}
