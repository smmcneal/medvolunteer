import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ShiftsView from './ShiftsView'

export interface LocationRow {
  id: string
  name: string
  lat: number | null
  lng: number | null
  geofence_radius_meters: number
}

export interface OrgLocation {
  id: string
  name: string
}

export interface ShiftRow {
  id: string
  name: string
  start_time: string
  end_time: string
  location_id: string | null
  notes: string | null
  locations: LocationRow | null
}

export interface TimeEntryRow {
  id: string
  volunteer_id: string
  shift_id: string | null
  clock_in: string
  clock_out: string | null
  duration_minutes: number | null
  method: string
}

export interface AssignmentWithShift {
  id: string
  shift_id: string
  status: string
  group_size: number
  shift: ShiftRow
  openEntry: TimeEntryRow | null
  pastEntries: TimeEntryRow[]
}

export interface AvailableShift {
  id: string
  name: string
  start_time: string
  end_time: string
  location_id: string | null
  notes: string | null
  required_count: number
  spots_left: number
  locations: LocationRow | null
}

export default async function ShiftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/volunteer/login')

  const admin = createAdminClient()


  const { data: volunteer } = await admin
    .from('volunteers')
    .select('id, org_id, status, pipeline_phase, volunteer_categories')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) redirect('/volunteer/login')

  // Fetch active locations for this org (used for the location picker)
  const { data: orgLocations } = await admin
    .from('locations')
    .select('id, name')
    .eq('org_id', volunteer.org_id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Fetch all non-cancelled assignments with shift + location
  const { data: rawAssignments } = await admin
    .from('shift_assignments')
    .select('id, shift_id, status, group_size, shifts(id, name, start_time, end_time, location_id, notes, locations(id, name, lat, lng, geofence_radius_meters))')
    .eq('volunteer_id', volunteer.id)
    .neq('status', 'cancelled')

  const assignments = rawAssignments ?? []
  const shiftIds = assignments.map((a: { shift_id: string }) => a.shift_id)

  // Fetch all time entries for these shifts in one query
  const timeEntries: TimeEntryRow[] = shiftIds.length > 0
    ? ((await admin
        .from('time_entries')
        .select('id, volunteer_id, shift_id, clock_in, clock_out, duration_minutes, method')
        .eq('volunteer_id', volunteer.id)
        .in('shift_id', shiftIds)
        .order('clock_in', { ascending: false })
      ).data ?? []) as TimeEntryRow[]
    : []

  // Group time entries by shift_id
  const teByShift: Record<string, TimeEntryRow[]> = {}
  for (const te of timeEntries) {
    if (!te.shift_id) continue
    if (!teByShift[te.shift_id]) teByShift[te.shift_id] = []
    teByShift[te.shift_id].push(te)
  }

  // Enrich assignments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched: AssignmentWithShift[] = (assignments as any[]).map((a: {
    id: string
    shift_id: string
    status: string
    group_size: number
    shifts: ShiftRow
  }) => ({
    id: a.id,
    shift_id: a.shift_id,
    status: a.status,
    group_size: a.group_size ?? 1,
    shift: a.shifts,
    openEntry: teByShift[a.shift_id]?.find(te => !te.clock_out) ?? null,
    pastEntries: teByShift[a.shift_id]?.filter(te => !!te.clock_out) ?? [],
  }))

  // Fetch available shifts if volunteer is eligible to self-signup
  let availableShifts: AvailableShift[] = []
  const canSelfSignup = volunteer.status === 'volunteer'

  if (canSelfSignup) {
    const now = new Date().toISOString()
    const { data: upcomingShifts } = await admin
      .from('shifts')
      .select('id, name, start_time, end_time, location_id, notes, required_count, required_categories, locations(id, name, lat, lng, geofence_radius_meters)')
      .eq('org_id', volunteer.org_id)
      .gt('start_time', now)
      .order('start_time', { ascending: true })

    const allShifts = upcomingShifts ?? []

    if (allShifts.length > 0) {
      const allShiftIds = allShifts.map((s: { id: string }) => s.id)

      const { data: takenAssignments } = await admin
        .from('shift_assignments')
        .select('shift_id, group_size')
        .in('shift_id', allShiftIds)
        .neq('status', 'cancelled')

      const countByShift: Record<string, number> = {}
      for (const a of (takenAssignments ?? [])) {
        countByShift[a.shift_id] = (countByShift[a.shift_id] ?? 0) + (a.group_size ?? 1)
      }

      const assignedShiftIds = new Set(enriched.map(a => a.shift_id))

      const volunteerCategories: string[] = (volunteer as { volunteer_categories?: string[] }).volunteer_categories ?? []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      availableShifts = (allShifts as any[])
        .filter(s => {
          const taken = countByShift[s.id] ?? 0
          if (taken >= s.required_count || assignedShiftIds.has(s.id)) return false
          // Category filter: if shift restricts to categories, volunteer must match one
          const requiredCats: string[] = s.required_categories ?? []
          if (requiredCats.length > 0 && !volunteerCategories.some((c: string) => requiredCats.includes(c))) return false
          return true
        })
        .map(s => ({
          id: s.id,
          name: s.name,
          start_time: s.start_time,
          end_time: s.end_time,
          location_id: s.location_id,
          notes: s.notes,
          required_count: s.required_count,
          spots_left: s.required_count - (countByShift[s.id] ?? 0),
          locations: s.locations ?? null,
        }))
    }
  }

  return (
    <ShiftsView
      assignments={enriched}
      volunteerId={volunteer.id}
      orgId={volunteer.org_id}
      availableShifts={availableShifts}
      orgLocations={(orgLocations ?? []) as OrgLocation[]}
    />
  )
}
