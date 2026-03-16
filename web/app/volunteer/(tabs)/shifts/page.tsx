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
  shift: ShiftRow
  openEntry: TimeEntryRow | null
  pastEntries: TimeEntryRow[]
}

export default async function ShiftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/volunteer/login')

  const admin = createAdminClient()

  const { data: volunteer } = await admin
    .from('volunteers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!volunteer) redirect('/volunteer/login')

  // Fetch all non-cancelled assignments with shift + location
  const { data: rawAssignments } = await admin
    .from('shift_assignments')
    .select('id, shift_id, status, shifts(id, name, start_time, end_time, location_id, notes, locations(id, name, lat, lng, geofence_radius_meters))')
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
    shifts: ShiftRow
  }) => ({
    id: a.id,
    shift_id: a.shift_id,
    status: a.status,
    shift: a.shifts,
    openEntry: teByShift[a.shift_id]?.find(te => !te.clock_out) ?? null,
    pastEntries: teByShift[a.shift_id]?.filter(te => !!te.clock_out) ?? [],
  }))

  return <ShiftsView assignments={enriched} volunteerId={volunteer.id} />
}
