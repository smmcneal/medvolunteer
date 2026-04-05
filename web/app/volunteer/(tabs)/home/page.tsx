import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import HomeView from './HomeView'
import type { Volunteer, Shift, Credential } from '@/types/database'

interface ShiftWithLocation extends Shift {
  locations: { name: string } | null
}

interface UpcomingAssignment {
  id: string
  shift: ShiftWithLocation
}

interface HomeData {
  volunteer: Volunteer
  upcomingAssignments: UpcomingAssignment[]
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

  // Run remaining queries in parallel
  const [assignmentsResult, workflowResult, progressResult, credsResult, activeEntryResult] = await Promise.all([
    // Upcoming assignments with shift+location (next 3)
    admin
      .from('shift_assignments')
      .select('id, shifts(*, locations(name))')
      .eq('volunteer_id', volunteer.id)
      .neq('status', 'cancelled')
      .gte('shifts.start_time', now)
      .order('shifts(start_time)', { ascending: true })
      .limit(3),

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upcomingAssignments: UpcomingAssignment[] = ((assignmentsResult.data ?? []) as any[])
    .filter(a => a.shifts && new Date(a.shifts.start_time) >= new Date())
    .sort((a, b) => new Date(a.shifts.start_time).getTime() - new Date(b.shifts.start_time).getTime())
    .slice(0, 3)
    .map(a => ({ id: a.id, shift: a.shifts as ShiftWithLocation }))

  return {
    volunteer: volunteer as Volunteer,
    upcomingAssignments,
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
