import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import ShiftsView from './ShiftsView'
import type { Location, Volunteer, TimeEntry, OrgHoliday, Category } from '@/types/database'

// Force dynamic rendering so router.refresh() always re-runs this page
export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssignmentWithVolunteer {
  id: string
  volunteer_id: string
  role: string | null
  status: string
  mentor_id: string | null
  volunteer: Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'category' | 'pipeline_phase'>
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
  required_categories: string[]
  notes: string | null
  recurrence_rule: string | null
  recurrence_group_id: string | null
  recurrence_end_date: string | null
  assignments: AssignmentWithVolunteer[]
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchShiftsData() {
  noStore() // opt out of per-request fetch cache
  const supabase = createAdminClient()

  // Fetch 6-month window: 1 month back to 4 months ahead
  const rangeStart = new Date()
  rangeStart.setMonth(rangeStart.getMonth() - 1)
  rangeStart.setDate(1)
  const rangeEnd = new Date()
  rangeEnd.setMonth(rangeEnd.getMonth() + 4)
  rangeEnd.setDate(0)

  const [shiftsRes, locationsRes, volunteersRes, holidaysRes, categoriesRes] = await Promise.all([
    supabase
      .from('shifts')
      .select(`
        id, name, location_id, start_time, end_time, required_count, required_categories, notes,
        recurrence_rule, recurrence_group_id, recurrence_end_date,
        location:locations(id, name),
        shift_assignments(
          id, role, status, volunteer_id, mentor_id,
          volunteer:volunteers!volunteer_id(id, first_name, last_name, category, pipeline_phase)
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
      .select('id, first_name, last_name, category, status, pipeline_phase')
      .in('status', ['volunteer', 'prospect'])
      .order('first_name'),

    supabase
      .from('org_holidays')
      .select('id, name, date, is_recurring'),

    supabase
      .from('categories')
      .select('id, slug, name')
      .eq('is_archived', false)
      .order('sort_order'),
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
    required_categories: (s as any).required_categories ?? [],
    notes: s.notes,
    recurrence_rule: (s as any).recurrence_rule ?? null,
    recurrence_group_id: (s as any).recurrence_group_id ?? null,
    recurrence_end_date: (s as any).recurrence_end_date ?? null,
    assignments: ((s.shift_assignments ?? []) as unknown as AssignmentWithVolunteer[])
      .filter(a => a.status !== 'cancelled')
      .map(a => ({
        ...a,
        time_entry: teByKey[`${s.id}_${a.volunteer_id}`] ?? null,
      })),
  }))

  return {
    shifts,
    locations: (locationsRes.data ?? []) as Pick<Location, 'id' | 'name'>[],
    volunteers: (volunteersRes.data ?? []) as Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'category' | 'status' | 'pipeline_phase'>[],
    holidays: (holidaysRes.data ?? []) as Pick<OrgHoliday, 'id' | 'name' | 'date' | 'is_recurring'>[],
    categories: (categoriesRes.data ?? []) as Pick<Category, 'id' | 'slug' | 'name'>[],
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ShiftsPage() {
  const { shifts, locations, volunteers, holidays, categories } = await fetchShiftsData()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ShiftsView shifts={shifts} locations={locations} volunteers={volunteers} holidays={holidays} categories={categories} />
    </div>
  )
}
