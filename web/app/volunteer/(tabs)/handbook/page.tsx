import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import HandbookView from './HandbookView'

export default async function HandbookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/volunteer/login')

  const admin = createAdminClient()

  const { data: volunteer } = await admin
    .from('volunteers')
    .select('id, first_name, last_name, handbook_signed_at, handbook_signed_name')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) redirect('/volunteer/login')

  return (
    <HandbookView
      volunteerId={volunteer.id}
      firstName={volunteer.first_name}
      lastName={volunteer.last_name}
      signedAt={volunteer.handbook_signed_at ?? null}
      signedName={volunteer.handbook_signed_name ?? null}
    />
  )
}
