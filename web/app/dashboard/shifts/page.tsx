import { createClient } from '@/lib/supabase/server'
import ShiftsView from './ShiftsView'
import type { Location, Volunteer, TimeEntry } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssignmentWithVolunteer {
  id: string
  volunteer_id: string
  role: string | null
  status: string
  volunteer: Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'category'>
  time_entry: TimeEntry | null
}

export interface ShiftWithRoster {
  id: string
  name: string
  location_id: string | null
  location_name: string | null
  start_time: string
  end_time: string
  required_count: number
  notes: string | null
  assignments: AssignmentWithVolunteer[]
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchShiftsData() {
  const supabase = await createClient()

  // Fetch 6-month window: 1 month back to 4 months ahead
  const rangeStart = new Date()
  rangeStart.setMonth(rangeStart.getMonth() - 1)
  rangeStart.setDate(1)
  const rangeEnd = new Date()
  rangeEnd.setMonth(rangeEnd.getMonth() + 4)
  rangeEnd.setDate(0)

  const [shiftsRes, locationsRes, volunteersRes] = await Promise.all([
    supabase
      .from('shifts')
      .select(`
        id, name, location_id, start_time, end_time, required_count, notes,
        location:locations(id, name),
        shift_assignments(
          id, role, status, volunteer_id,
          volunteer:volunteers(id, first_name, last_name, category)
        )
      `)
      .gte('start_time', rangeStart.toISOString())
      .lte('start_time', rangeEnd.toISOString())
      .order('start_time', { ascending: true }),

    supabase
      .from('locations')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),

    supabase
      .from('volunteers')
      .select('id, first_name, last_name, category, status')
      .in('status', ['active', 'onboarding'])
      .order('first_name'),
  ])

  // Fetch time entries for all these shifts
  const shiftIds = (shiftsRes.data ?? []).map(s => s.id)
  const { data: timeEntries } = shiftIds.length
    ? await supabase
        .from('time_entries')
        .select('*')
        .in('shift_id', shiftIds)
    : { data: [] }

  const teByKey: Record<string, TimeEntry> = {}
  for (const te of (timeEntries ?? []) as TimeEntry[]) {
    if (te.shift_id && te.volunteer_id) {
      teByKey[`${te.shift_id}_${te.volunteer_id}`] = te
    }
  }

  const shifts: ShiftWithRoster[] = (shiftsRes.data ?? []).map(s => ({
    id: s.id,
    name: s.name,
    location_id: s.location_id,
    location_name: (s.location as unknown as { name: string } | null)?.name ?? null,
    start_time: s.start_time,
    end_time: s.end_time,
    required_count: s.required_count,
    notes: s.notes,
    assignments: ((s.shift_assignments ?? []) as unknown as AssignmentWithVolunteer[]).map(a => ({
      ...a,
      time_entry: teByKey[`${s.id}_${a.volunteer_id}`] ?? null,
    })),
  }))

  return {
    shifts,
    locations: (locationsRes.data ?? []) as Pick<Location, 'id' | 'name'>[],
    volunteers: (volunteersRes.data ?? []) as Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'category' | 'status'>[],
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ShiftsPage() {
  const { shifts, locations, volunteers } = await fetchShiftsData()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ShiftsView shifts={shifts} locations={locations} volunteers={volunteers} />
    </div>
  )
}
