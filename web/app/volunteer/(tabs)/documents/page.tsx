import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import VolunteerDocumentsView from './VolunteerDocumentsView'
import type { OrgDocument } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function VolunteerDocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/volunteer/login')

  const admin = createAdminClient()

  const { data: docs } = await admin
    .from('org_documents')
    .select('*')
    .order('is_preset', { ascending: false })
    .order('sort_order')
    .order('created_at')

  return (
    <VolunteerDocumentsView
      docs={(docs ?? []) as OrgDocument[]}
    />
  )
}
