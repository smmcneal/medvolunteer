import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VolunteerShell from './VolunteerShell'

export default async function VolunteerTabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/volunteer/login')

  // Look up volunteer record
  const { data: volunteer } = await supabase
    .from('volunteers')
    .select('id, first_name, last_name, status, category')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) redirect('/volunteer/login')

  return (
    <VolunteerShell volunteer={volunteer}>
      {children}
    </VolunteerShell>
  )
}
