import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import VolunteersTable from './VolunteersTable'
import VolunteersHeader from './VolunteersHeader'
import type { VolunteerCategory, VolunteerStatus, PipelinePhase, Location } from '@/types/database'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VolunteerRow {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  photo_url: string | null
  category: VolunteerCategory
  status: VolunteerStatus
  pipeline_phase: PipelinePhase
  created_at: string
  locations: string[]
  onboarding_pct: number
  completed_stages: number
  total_stages: number
  tags: { id: string; name: string; color: string }[]
  active_flags: { id: string; name: string; color: string; severity: 'info' | 'warning' | 'critical' }[]
  hours_this_month: number
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchVolunteers(filters: {
  category?: string
  status?: string
  location?: string
}) {
  noStore()
  // Use service-role client so RLS never blocks admin dashboard reads.
  const supabase = createAdminClient()

  let query = supabase
    .from('volunteers')
    .select(`
      id, first_name, last_name, email, phone, photo_url,
      category, status, pipeline_phase, created_at, onboarding_workflow_id,
      volunteer_locations(location:locations(id, name)),
      volunteer_tags(tag:org_tags(id, name, color))
    `)
    .order('created_at', { ascending: false })

  if (filters.category) query = query.eq('category', filters.category)
  if (filters.status)   query = query.eq('status', filters.status)

  const { data: volunteers } = await query
  if (!volunteers) return []

  const volunteerIds = volunteers.map(v => v.id)
  const { data: progressRows } = volunteerIds.length
    ? await supabase.from('onboarding_progress').select('volunteer_id, completed_at').in('volunteer_id', volunteerIds)
    : { data: [] }

  const { data: flagRows } = volunteerIds.length
    ? await supabase
        .from('volunteer_flags')
        .select('volunteer_id, flag:org_flags(id, name, color, severity)')
        .in('volunteer_id', volunteerIds)
        .is('resolved_at', null)
    : { data: [] }

  type FlagShape = { id: string; name: string; color: string; severity: 'info' | 'warning' | 'critical' }
  const flagMap: Record<string, FlagShape[]> = {}
  for (const f of (flagRows ?? []) as { volunteer_id: string; flag: FlagShape | FlagShape[] | null }[]) {
    if (!f.flag) continue
    const flag = Array.isArray(f.flag) ? f.flag[0] : f.flag
    if (!flag) continue
    if (!flagMap[f.volunteer_id]) flagMap[f.volunteer_id] = []
    flagMap[f.volunteer_id].push(flag)
  }

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: hourRows } = volunteerIds.length
    ? await supabase
        .from('time_entries')
        .select('volunteer_id, duration_minutes, clock_in, clock_out')
        .in('volunteer_id', volunteerIds)
        .gte('clock_in', startOfMonth)
    : { data: [] }

  const hoursMap: Record<string, number> = {}
  const now = Date.now()
  for (const e of hourRows ?? []) {
    const mins = e.duration_minutes != null
      ? e.duration_minutes
      : e.clock_out == null
        ? Math.floor((now - new Date(e.clock_in).getTime()) / 60000)
        : 0
    hoursMap[e.volunteer_id] = (hoursMap[e.volunteer_id] ?? 0) + mins
  }

  const workflowIds = [...new Set(volunteers.map(v => v.onboarding_workflow_id).filter(Boolean))]
  const { data: stageRows } = workflowIds.length
    ? await supabase.from('onboarding_stages').select('workflow_id, id').in('workflow_id', workflowIds)
    : { data: [] }

  const progressMap: Record<string, { total: number; completed: number }> = {}
  for (const v of volunteers) {
    const totalStages = (stageRows ?? []).filter(s => s.workflow_id === v.onboarding_workflow_id).length
    const completedStages = (progressRows ?? []).filter(p => p.volunteer_id === v.id && p.completed_at).length
    progressMap[v.id] = { total: totalStages, completed: completedStages }
  }

  const rows: VolunteerRow[] = volunteers
    .map(v => {
      const locations = (v.volunteer_locations ?? [])
        .map((vl: any) => (vl.location as { name: string } | null)?.name)
        .filter(Boolean) as string[]
      const tags = (v.volunteer_tags ?? [])
        .map((vt: any) => vt.tag as { id: string; name: string; color: string } | null)
        .filter(Boolean) as { id: string; name: string; color: string }[]
      const { total, completed } = progressMap[v.id] ?? { total: 0, completed: 0 }
      return {
        id: v.id,
        first_name: v.first_name,
        last_name: v.last_name,
        email: v.email,
        phone: v.phone,
        photo_url: v.photo_url,
        category: v.category,
        status: v.status,
        pipeline_phase: v.pipeline_phase,
        created_at: v.created_at,
        locations,
        tags,
        active_flags: flagMap[v.id] ?? [],
        hours_this_month: Math.round((hoursMap[v.id] ?? 0) / 60 * 10) / 10,
        onboarding_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
        completed_stages: completed,
        total_stages: total,
      }
    })
    .filter(v => !filters.location || v.locations.some(l => l.toLowerCase().includes(filters.location!.toLowerCase())))

  return rows
}

async function fetchLocations() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('locations').select('id, name').eq('is_active', true)
  return (data ?? []) as Pick<Location, 'id' | 'name'>[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VolunteersPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; location?: string }>
}) {
  const params = await searchParams
  const [volunteers, locations] = await Promise.all([
    fetchVolunteers(params),
    fetchLocations(),
  ])

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <VolunteersHeader count={volunteers.length} locations={locations} />
      <VolunteersTable
        volunteers={volunteers}
        locations={locations}
        initialFilters={params}
      />
    </div>
  )
}
