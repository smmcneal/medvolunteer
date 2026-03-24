import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import VolunteerDocumentsView from './VolunteerDocumentsView'
import type { OrgDocument, OnboardingProgress, OnboardingStage } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function VolunteerDocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/volunteer/login')

  const admin = createAdminClient()

  const { data: volunteer } = await admin
    .from('volunteers')
    .select('id, onboarding_workflow_id, created_at')
    .eq('user_id', user.id)
    .single()

  const [docsRes, progressRes] = await Promise.all([
    admin
      .from('org_documents')
      .select('*')
      .eq('volunteer_visible', true)
      .order('is_preset', { ascending: false })
      .order('sort_order')
      .order('created_at'),
    volunteer?.id
      ? admin
          .from('onboarding_progress')
          .select('*, onboarding_stages(id, name, description, order_index, stage_type)')
          .eq('volunteer_id', volunteer.id)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  return (
    <VolunteerDocumentsView
      docs={(docsRes.data ?? []) as OrgDocument[]}
      onboardingProgress={(progressRes.data ?? []) as (OnboardingProgress & { onboarding_stages: OnboardingStage | null })[]}
      volunteerCreatedAt={volunteer?.created_at ?? null}
    />
  )
}
