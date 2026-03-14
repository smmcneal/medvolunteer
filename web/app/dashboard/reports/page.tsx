import { createClient } from '@/lib/supabase/server'
import ReportsView from './ReportsView'

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

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchReportsData() {
  const supabase = await createClient()

  const [
    timeEntriesRes,
    volunteersRes,
    workflowsRes,
    stagesRes,
    progressRes,
    bgChecksRes,
    credentialsRes,
  ] = await Promise.all([
    // All time entries with volunteer info
    supabase
      .from('time_entries')
      .select('volunteer_id, duration_minutes')
      .not('duration_minutes', 'is', null),

    // All volunteers for name lookup
    supabase
      .from('volunteers')
      .select('id, first_name, last_name, category, onboarding_workflow_id')
      .order('first_name'),

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
  ])

  const volunteers = volunteersRes.data ?? []
  const volMap: Record<string, { name: string; category: string; workflow_id: string | null }> = {}
  for (const v of volunteers) {
    volMap[v.id] = {
      name: `${v.first_name} ${v.last_name}`,
      category: v.category,
      workflow_id: v.onboarding_workflow_id,
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

  return { hoursRows, onboardingRows, bgRows, credRows }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportsPage() {
  const { hoursRows, onboardingRows, bgRows, credRows } = await fetchReportsData()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '28px 32px 20px', borderBottom: '1px solid #f0f0f0',
        background: 'white', flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>Reports</h1>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>Export data and monitor program metrics</p>
      </div>

      <ReportsView
        hoursRows={hoursRows}
        onboardingRows={onboardingRows}
        bgRows={bgRows}
        credRows={credRows}
      />
    </div>
  )
}
