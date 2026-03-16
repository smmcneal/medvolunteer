import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import VolunteerShell from './VolunteerShell'

export default async function VolunteerTabsLayout({ children }: { children: React.ReactNode }) {
  // Use createClient (user session) only for auth — it respects RLS.
  // Use createAdminClient (service role) for the volunteer lookup — the
  // volunteers table has RLS enabled with no read policy yet, so a regular
  // client query would return null even when the row exists.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/volunteer/login')

  // Look up volunteer record bypassing RLS
  const admin = createAdminClient()
  const { data: volunteer } = await admin
    .from('volunteers')
    .select('id, first_name, last_name, status, category')
    .eq('user_id', user.id)
    .single()

  // Authenticated but no volunteer record (e.g. admin visiting the volunteer portal).
  // Redirect to homepage rather than /volunteer/login — middleware would
  // immediately bounce an authenticated user from /volunteer/login back to
  // /volunteer/home, creating an infinite redirect loop.
  if (!volunteer) redirect('/')

  return (
    <VolunteerShell volunteer={volunteer}>
      {children}
    </VolunteerShell>
  )
}
