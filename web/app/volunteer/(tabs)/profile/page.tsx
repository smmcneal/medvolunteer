import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ProfileView from './ProfileView'
import type { Credential, VolunteerUpload } from '@/types/database'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/volunteer/login')

  const admin = createAdminClient()

  const { data: volunteer } = await admin
    .from('volunteers')
    .select('id, first_name, last_name, email, phone, photo_url, category, status, created_at, emergency_contact_name, emergency_contact_phone')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) redirect('/volunteer/login')

  const [credResult, credUploadsResult] = await Promise.all([
    admin
      .from('credentials')
      .select('*')
      .eq('volunteer_id', volunteer.id)
      .order('expiration_date', { ascending: true }),

    admin
      .from('volunteer_uploads')
      .select('*')
      .eq('volunteer_id', volunteer.id)
      .eq('category', 'credential')
      .order('uploaded_at', { ascending: false }),
  ])

  return (
    <ProfileView
      volunteer={volunteer}
      credentials={(credResult.data ?? []) as Credential[]}
      credentialUploads={(credUploadsResult.data ?? []) as VolunteerUpload[]}
    />
  )
}
