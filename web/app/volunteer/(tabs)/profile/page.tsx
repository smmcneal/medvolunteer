import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileView from './ProfileView'
import type { Credential, Document, BackgroundCheck } from '@/types/database'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/volunteer/login')

  const { data: volunteer } = await supabase
    .from('volunteers')
    .select('id, first_name, last_name, email, phone, photo_url, category, status, created_at')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) redirect('/volunteer/login')

  const [credResult, docResult, bgResult] = await Promise.all([
    supabase
      .from('credentials')
      .select('*')
      .eq('volunteer_id', volunteer.id)
      .order('expiration_date', { ascending: true }),

    supabase
      .from('documents')
      .select('*')
      .eq('volunteer_id', volunteer.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('background_checks')
      .select('*')
      .eq('volunteer_id', volunteer.id)
      .order('initiated_at', { ascending: false })
      .limit(1),
  ])

  return (
    <ProfileView
      volunteer={volunteer}
      credentials={(credResult.data ?? []) as Credential[]}
      documents={(docResult.data ?? []) as Document[]}
      backgroundCheck={(bgResult.data?.[0] ?? null) as BackgroundCheck | null}
    />
  )
}
