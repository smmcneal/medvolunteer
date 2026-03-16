import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import HomeView from './HomeView'
import type { Volunteer, Shift, Credential } from '@/types/database'

interface ShiftWithLocation extends Shift {
  locations: { name: string } | null
}

interface HomeData {
  volunteer: Volunteer
  upcomingShifts: ShiftWithLocation[]
  onboardingPct: number
  onboardingCompleted: number
  onboardingTotal: number
  expiringCredentials: Pick<Credential, 'id' | 'type' | 'expiration_date'>[]
  activeEntry: { id: string; clock_in: string } | null
}

async function fetchHomeData(): Promise<HomeData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/volunteer/login')

  const admin = createAdminClient()

  const { data: volunteer } = await admin
    .from('volunteers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) redirect('/volunteer/login')

  const now = new Date().toISOString()
  const thirtyDays = new Date()
  thirtyDays.setDate(thirtyDays.getDate() + 30)

  // Get shift IDs this volunteer is assigned to
  const { data: assignments } = await admin
    .from('shift_assignments')
    .select('shift_id')
    .eq('volunteer_id', volunteer.id)
    .neq('status', 'cancelled')

  const shiftIds = assignments?.map((a: { shift_id: string }) => a.shift_id) ?? []

  // Run remaining queries in parallel
  const [shiftsResult, workflowResult, progressResult, credsResult, activeEntryResult] = await Promise.all([
    // Upcoming shifts (next 3)
    shiftIds.length > 0
      ? admin
          .from('shifts')
          .select('*, locations(name)')
          .in('id', shiftIds)
          .gte('start_time', now)
          .order('start_time', { ascending: true })
          .limit(3)
      : Promise.resolve({ data: [] }),

    // Active onboarding workflow for this volunteer's category
    admin
      .from('onboarding_workflows')
      .select('id, onboarding_stages(id)')
      .eq('applies_to_category', volunteer.category)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),

    // Completed onboarding stages
    admin
      .from('onboarding_progress')
      .select('stage_id')
      .eq('volunteer_id', volunteer.id)
      .not('completed_at', 'is', null),

    // Credentials expiring in the next 30 days
    admin
      .from('credentials')
      .select('id, type, expiration_date')
      .eq('volunteer_id', volunteer.id)
      .gte('expiration_date', new Date().toISOString().split('T')[0])
      .lte('expiration_date', thirtyDays.toISOString().split('T')[0])
      .order('expiration_date', { ascending: true }),

    // Active clock-in (no clock_out yet)
    admin
      .from('time_entries')
      .select('id, clock_in')
      .eq('volunteer_id', volunteer.id)
      .is('clock_out', null)
      .maybeSingle(),
  ])

  const totalStages = (workflowResult.data as { onboarding_stages: { id: string }[] } | null)
    ?.onboarding_stages?.length ?? 0
  const completedStages = progressResult.data?.length ?? 0

  return {
    volunteer: volunteer as Volunteer,
    upcomingShifts: (shiftsResult.data ?? []) as ShiftWithLocation[],
    onboardingPct: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 100,
    onboardingCompleted: completedStages,
    onboardingTotal: totalStages,
    expiringCredentials: (credsResult.data ?? []) as Pick<Credential, 'id' | 'type' | 'expiration_date'>[],
    activeEntry: activeEntryResult.data as { id: string; clock_in: string } | null,
  }
}

export default async function HomePage() {
  const data = await fetchHomeData()
  return <HomeView {...data} />
}
