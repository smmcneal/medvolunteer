import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { UserPlus, Search } from 'lucide-react'
import VolunteersTable from './VolunteersTable'
import type { VolunteerCategory, VolunteerStatus, Location } from '@/types/database'

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
  created_at: string
  locations: string[]
  onboarding_pct: number
  completed_stages: number
  total_stages: number
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchVolunteers(filters: {
  category?: string
  status?: string
  location?: string
}) {
  const supabase = await createClient()

  // Fetch volunteers with location join
  let query = supabase
    .from('volunteers')
    .select(`
      id, first_name, last_name, email, phone, photo_url,
      category, status, created_at, onboarding_workflow_id,
      volunteer_locations(location:locations(id, name))
    `)
    .order('created_at', { ascending: false })

  if (filters.category) query = query.eq('category', filters.category)
  if (filters.status)   query = query.eq('status', filters.status)

  const { data: volunteers } = await query

  if (!volunteers) return []

  // Fetch onboarding progress counts per volunteer
  const volunteerIds = volunteers.map(v => v.id)
  const { data: progressRows } = await supabase
    .from('onboarding_progress')
    .select('volunteer_id, completed_at')
    .in('volunteer_id', volunteerIds)

  // Fetch total stages for each volunteer's workflow
  const workflowIds = [...new Set(volunteers.map(v => v.onboarding_workflow_id).filter(Boolean))]
  const { data: stageRows } = workflowIds.length
    ? await supabase.from('onboarding_stages').select('workflow_id, id').in('workflow_id', workflowIds)
    : { data: [] }

  // Build lookup maps
  const progressMap: Record<string, { total: number; completed: number }> = {}
  for (const v of volunteers) {
    const totalStages = (stageRows ?? []).filter(s => s.workflow_id === v.onboarding_workflow_id).length
    const completedStages = (progressRows ?? []).filter(p => p.volunteer_id === v.id && p.completed_at).length
    progressMap[v.id] = { total: totalStages, completed: completedStages }
  }

  // Flatten and apply location filter
  const rows: VolunteerRow[] = volunteers
    .map(v => {
      const locations = (v.volunteer_locations ?? [])
        .map((vl: { location: unknown }) => (vl.location as { name: string } | null)?.name)
        .filter(Boolean) as string[]
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
        created_at: v.created_at,
        locations,
        onboarding_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
        completed_stages: completed,
        total_stages: total,
      }
    })
    .filter(v => !filters.location || v.locations.some(l => l.toLowerCase().includes(filters.location!.toLowerCase())))

  return rows
}

async function fetchLocations() {
  const supabase = await createClient()
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

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>Volunteers</h1>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>{volunteers.length} volunteer{volunteers.length !== 1 ? 's' : ''}</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '9px 16px', borderRadius: '8px',
          background: '#1B2A4A', color: 'white',
          border: 'none', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600,
        }}>
          <UserPlus style={{ width: '14px', height: '14px' }} />
          Add Volunteer
        </button>
      </div>

      {/* Filters + Table (client component) */}
      <VolunteersTable
        volunteers={volunteers}
        locations={locations}
        initialFilters={params}
      />
    </div>
  )
}
