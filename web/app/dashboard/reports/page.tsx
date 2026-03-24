import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import { Suspense } from 'react'
import ReportsView from './ReportsView'
import type { Category } from '@/types/database'

export interface ActiveVolunteerActivity {
  id: string
  firstName: string
  lastName: string
  category: string
  lastActivityAt: string | null
}

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HoursRow {
  volunteer_id: string
  name: string
  category: string
  total_minutes: number
  session_count: number
}

export interface OnboardingRow {
  workflow_id: string
  workflow_name: string
  category: string | null
  total_volunteers: number
  fully_complete: number
  completion_rate: number
}

export interface PipelinePhaseCount {
  phase: string
  count: number
}

export interface VolunteerOnboardingRow {
  volunteer_id: string
  name: string
  category: string
  pipeline_phase: string
  workflow_name: string | null
  stages_completed: number
  stages_total: number
  completion_pct: number
}

export interface BgCheckRow {
  status: string
  result: string | null
  count: number
}

export interface CredentialExpiryRow {
  volunteer_id: string
  name: string
  credential_type: string
  expiration_date: string
  days_until_expiry: number
}

export interface FilterParams {
  status?: string
  category?: string
  dateFrom?: string
  dateTo?: string
  pipelinePhase?: string
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchReportsData(filters: FilterParams = {}) {
  noStore()
  const supabase = createAdminClient()

  // Unfiltered for filter UI options
  const { data: allVolData } = await supabase
    .from('volunteers')
    .select('category, status')
  const allCategories = [...new Set((allVolData ?? []).map((v: { category: string }) => v.category))].sort() as string[]
  const allStatuses   = [...new Set((allVolData ?? []).map((v: { status: string }) => v.status))].sort() as string[]

  let volQuery = supabase
    .from('volunteers')
    .select('id, first_name, last_name, category, status, onboarding_workflow_id, pipeline_phase, created_at')
    .order('first_name')
  if (filters.status)        volQuery = volQuery.eq('status', filters.status)
  if (filters.category)      volQuery = volQuery.eq('category', filters.category)
  if (filters.pipelinePhase) volQuery = volQuery.eq('pipeline_phase', filters.pipelinePhase)
  if (filters.dateFrom)      volQuery = volQuery.gte('created_at', filters.dateFrom)
  if (filters.dateTo)        volQuery = volQuery.lte('created_at', filters.dateTo + 'T23:59:59')

  const [
    timeEntriesRes,
    volunteersRes,
    workflowsRes,
    stagesRes,
    progressRes,
    bgChecksRes,
    credentialsRes,
    activeTimeRes,
  ] = await Promise.all([
    // All time entries with volunteer info
    supabase
      .from('time_entries')
      .select('volunteer_id, duration_minutes')
      .not('duration_minutes', 'is', null),

    // Volunteers (filtered)
    volQuery,

    // Onboarding workflows
    supabase
      .from('onboarding_workflows')
      .select('id, name, applies_to_category')
      .eq('is_active', true),

    // All stages per workflow
    supabase
      .from('onboarding_stages')
      .select('id, workflow_id'),

    // All completed onboarding progress
    supabase
      .from('onboarding_progress')
      .select('volunteer_id, stage_id')
      .not('completed_at', 'is', null),

    // Background checks
    supabase
      .from('background_checks')
      .select('status, result, volunteer_id'),

    // Expiring credentials (next 90 days)
    supabase
      .from('credentials')
      .select('volunteer_id, type, expiration_date')
      .not('expiration_date', 'is', null)
      .gte('expiration_date', new Date().toISOString().split('T')[0])
      .lte('expiration_date', new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0])
      .order('expiration_date', { ascending: true }),

    // Last clock-in per active volunteer (for inactive report)
    supabase
      .from('time_entries')
      .select('volunteer_id, clock_in')
      .not('clock_out', 'is', null)
      .order('clock_in', { ascending: false }),
  ])

  const volunteers = volunteersRes.data ?? []
  const volMap: Record<string, { name: string; category: string; workflow_id: string | null; pipeline_phase: string }> = {}
  for (const v of volunteers) {
    volMap[v.id] = {
      name: `${v.first_name} ${v.last_name}`,
      category: v.category,
      workflow_id: v.onboarding_workflow_id,
      pipeline_phase: v.pipeline_phase ?? 'intake',
    }
  }

  // ── Hours report ────────────────────────────────────────────────
  const hoursMap: Record<string, { total_minutes: number; session_count: number }> = {}
  for (const te of (timeEntriesRes.data ?? []) as { volunteer_id: string; duration_minutes: number }[]) {
    if (!hoursMap[te.volunteer_id]) hoursMap[te.volunteer_id] = { total_minutes: 0, session_count: 0 }
    hoursMap[te.volunteer_id].total_minutes += te.duration_minutes ?? 0
    hoursMap[te.volunteer_id].session_count += 1
  }

  const hoursRows: HoursRow[] = Object.entries(hoursMap)
    .map(([volunteer_id, stats]) => ({
      volunteer_id,
      name: volMap[volunteer_id]?.name ?? 'Unknown',
      category: volMap[volunteer_id]?.category ?? 'other',
      ...stats,
    }))
    .sort((a, b) => b.total_minutes - a.total_minutes)

  // ── Onboarding completion ────────────────────────────────────────
  const workflows = workflowsRes.data ?? []
  const stages    = stagesRes.data ?? []
  const progress  = progressRes.data ?? []

  const onboardingRows: OnboardingRow[] = workflows.map(w => {
    const wStageIds = new Set(stages.filter(s => s.workflow_id === w.id).map(s => s.id))
    const wVolunteers = volunteers.filter(v => v.onboarding_workflow_id === w.id)

    const fullyComplete = wVolunteers.filter(v => {
      if (wStageIds.size === 0) return false
      const completedForV = new Set(
        progress.filter(p => p.volunteer_id === v.id && wStageIds.has(p.stage_id)).map(p => p.stage_id)
      )
      return completedForV.size === wStageIds.size
    }).length

    return {
      workflow_id: w.id,
      workflow_name: w.name,
      category: w.applies_to_category,
      total_volunteers: wVolunteers.length,
      fully_complete: fullyComplete,
      completion_rate: wVolunteers.length > 0
        ? Math.round((fullyComplete / wVolunteers.length) * 100)
        : 0,
    }
  })

  // ── Pipeline phase breakdown ─────────────────────────────────────
  const PIPELINE_PHASES = ['intake', 'orientation', 'review', 'training', 'active', 'offboarding']
  const phaseCountMap: Record<string, number> = {}
  for (const phase of PIPELINE_PHASES) phaseCountMap[phase] = 0
  for (const v of volunteers) {
    const p = v.pipeline_phase ?? 'intake'
    phaseCountMap[p] = (phaseCountMap[p] ?? 0) + 1
  }
  const pipelineStats: PipelinePhaseCount[] = PIPELINE_PHASES.map(phase => ({
    phase,
    count: phaseCountMap[phase] ?? 0,
  }))

  // ── Per-volunteer onboarding rows ────────────────────────────────
  const workflowMap: Record<string, string> = {}
  for (const w of workflows) workflowMap[w.id] = w.name

  const stagesByWorkflow: Record<string, Set<string>> = {}
  for (const s of stages) {
    if (!stagesByWorkflow[s.workflow_id]) stagesByWorkflow[s.workflow_id] = new Set()
    stagesByWorkflow[s.workflow_id].add(s.id)
  }

  const completedByVol: Record<string, Set<string>> = {}
  for (const p of progress) {
    if (!completedByVol[p.volunteer_id]) completedByVol[p.volunteer_id] = new Set()
    completedByVol[p.volunteer_id].add(p.stage_id)
  }

  const volunteerOnboardingRows: VolunteerOnboardingRow[] = volunteers.map(v => {
    const wfId = v.onboarding_workflow_id
    const wfStages = wfId ? stagesByWorkflow[wfId] ?? new Set<string>() : new Set<string>()
    const stagesTotal = wfStages.size
    const volCompleted = completedByVol[v.id] ?? new Set<string>()
    const stagesCompleted = stagesTotal > 0
      ? [...wfStages].filter(sid => volCompleted.has(sid)).length
      : 0
    return {
      volunteer_id: v.id,
      name: `${v.first_name} ${v.last_name}`,
      category: v.category,
      pipeline_phase: v.pipeline_phase ?? 'intake',
      workflow_name: wfId ? (workflowMap[wfId] ?? null) : null,
      stages_completed: stagesCompleted,
      stages_total: stagesTotal,
      completion_pct: stagesTotal > 0 ? Math.round((stagesCompleted / stagesTotal) * 100) : 0,
    }
  })

  // ── Background checks ────────────────────────────────────────────
  const bgMap: Record<string, number> = {}
  for (const b of (bgChecksRes.data ?? []) as { status: string; result: string | null }[]) {
    const key = b.result ?? b.status
    bgMap[key] = (bgMap[key] ?? 0) + 1
  }
  const bgRows: BgCheckRow[] = Object.entries(bgMap).map(([key, count]) => ({
    status: (bgChecksRes.data ?? []).find((b: { status: string; result: string | null }) => (b.result ?? b.status) === key)?.status ?? '',
    result: (bgChecksRes.data ?? []).find((b: { status: string; result: string | null }) => (b.result ?? b.status) === key)?.result ?? null,
    count,
  }))

  // ── Credential expiry ────────────────────────────────────────────
  const credRows: CredentialExpiryRow[] = (credentialsRes.data ?? []).map(
    (c: { volunteer_id: string; type: string; expiration_date: string }) => ({
      volunteer_id: c.volunteer_id,
      name: volMap[c.volunteer_id]?.name ?? 'Unknown',
      credential_type: c.type,
      expiration_date: c.expiration_date,
      days_until_expiry: Math.ceil(
        (new Date(c.expiration_date).getTime() - Date.now()) / 86400000
      ),
    })
  )

  // ── Active volunteer activity (for inactive report) ──────────────
  const lastClockInMap: Record<string, string> = {}
  for (const e of (activeTimeRes.data ?? []) as { volunteer_id: string; clock_in: string }[]) {
    if (!lastClockInMap[e.volunteer_id]) {
      lastClockInMap[e.volunteer_id] = e.clock_in
    }
  }
  const activeVolunteerActivity: ActiveVolunteerActivity[] = volunteers
    .filter(v => v.status === 'volunteer')
    .map(v => ({
      id: v.id,
      firstName: v.first_name,
      lastName: v.last_name,
      category: v.category,
      lastActivityAt: lastClockInMap[v.id] ?? null,
    }))

  return { hoursRows, onboardingRows, pipelineStats, volunteerOnboardingRows, bgRows, credRows, activeVolunteerActivity, allCategories, allStatuses, volunteers }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; dateFrom?: string; dateTo?: string; pipelinePhase?: string }>
}) {
  const { status, category, dateFrom, dateTo, pipelinePhase } = await searchParams
  const filters: FilterParams = { status, category, dateFrom, dateTo, pipelinePhase }

  const { hoursRows, onboardingRows, pipelineStats, volunteerOnboardingRows, bgRows, credRows, activeVolunteerActivity, allCategories, allStatuses, volunteers } = await fetchReportsData(filters)

  // Pending hours
  const supabase = createAdminClient()
  const { data: categoriesData } = await supabase.from('categories').select('*').eq('is_archived', false).order('sort_order')
  const categories = (categoriesData ?? []) as Category[]
  const { data: orgData } = await supabase.from('organizations').select('settings').limit(1).single()
  const requireHourApproval = !!(orgData?.settings as Record<string, unknown>)?.require_hour_approval

  let pendingHours: { id: string; volunteer_name: string; clock_in: string; clock_out: string; hours: number }[] = []
  if (requireHourApproval) {
    const volIds = volunteers.map((v: { id: string }) => v.id)
    const { data: pendingData } = await supabase
      .from('time_entries')
      .select('id, clock_in, clock_out, volunteer_id')
      .eq('approval_status', 'pending')
      .not('clock_out', 'is', null)
      .in('volunteer_id', volIds.length > 0 ? volIds : ['00000000-0000-0000-0000-000000000000'])
      .order('clock_in', { ascending: false })
    const volMap: Record<string, string> = {}
    for (const v of volunteers) volMap[v.id] = `${v.first_name} ${v.last_name}`
    pendingHours = ((pendingData ?? []) as { id: string; clock_in: string; clock_out: string; volunteer_id: string }[]).map(e => ({
      id: e.id,
      volunteer_name: volMap[e.volunteer_id] ?? 'Unknown',
      clock_in: e.clock_in,
      clock_out: e.clock_out,
      hours: Math.round((new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000 * 10) / 10,
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '28px 32px 20px', borderBottom: '1px solid #f0f0f0',
        background: 'white', flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>Reports</h1>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>Export data and monitor program metrics</p>
      </div>

      <Suspense fallback={null}>
        <ReportsView
          hoursRows={hoursRows}
          onboardingRows={onboardingRows}
          pipelineStats={pipelineStats}
          volunteerOnboardingRows={volunteerOnboardingRows}
          bgRows={bgRows}
          credRows={credRows}
          activeVolunteerActivity={activeVolunteerActivity}
          allCategories={allCategories}
          allStatuses={allStatuses}
          appliedFilters={filters}
          requireHourApproval={requireHourApproval}
          pendingHours={pendingHours}
          categories={categories}
        />
      </Suspense>
    </div>
  )
}
