'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function markAlertRead(alertId: string) {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('internal_alerts')
    .update({ is_read: true })
    .eq('id', alertId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/alerts')
}

export async function markAllAlertsRead() {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('internal_alerts')
    .update({ is_read: true })
    .eq('is_read', false)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/alerts')
}
