'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markMessageRead(recipientId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify ownership via join before updating
  const { data: recipient } = await supabase
    .from('message_recipients')
    .select('id, volunteers(user_id)')
    .eq('id', recipientId)
    .single()

  const owner = (recipient?.volunteers as { user_id: string } | null)?.user_id
  if (!recipient || owner !== user.id) throw new Error('Not found or access denied')

  const { error } = await supabase
    .from('message_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('id', recipientId)
    .is('read_at', null) // no-op if already read

  if (error) throw new Error(error.message)
  revalidatePath('/volunteer/messages')
}
