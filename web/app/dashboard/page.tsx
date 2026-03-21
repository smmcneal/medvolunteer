import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import {
  Users, Clock, CalendarDays,
  AlertTriangle, TrendingUp, MapPin, Activity
} from 'lucide-react'
import type { Volunteer, Credential, TimeEntry, Location } from '@/types/database'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  activeVolunteers: number
  hoursThisMonth: number
  openShifts: number
}

interface ExpiringCred extends Credential {
  volunteer: Pick<Volunteer, 'id' | 'first_name' | 'last_name'>
  days_until_expiry: number
}

interface CheckIn extends TimeEntry {
  volunteer: Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'category'>
  location: Pick<Location, 'name'> | null
}

interface ClockedInEntry {
  id: string
  clock_in: string
  volunteer: Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'category'> | null
}

interface VolunteerHours {
  id: string
  first_name: string
  last_name: string
  category: string | null
  hours: number
}

interface OpenShift {
  id: string
  name: string
  start_time: string
  end_time: string
  required_count: number
  location_name: string | null
  assigned: number
  spots_left: number
}

interface FlaggedVolunteer {
  volunteer_id: string
  first_name: string
  last_name: string
  notes: string | null
  raised_at: string
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchDashboardData() {
  noStore()
  const supabase = createAdminClient()

  // Match the shifts page window: 1 month back → 4 months ahead
  const shiftsRangeStart = new Date()
  shiftsRangeStart.setMonth(shiftsRangeStart.getMonth() - 1)
  shiftsRangeStart.setDate(1)
  const shiftsRangeEnd = new Date()
  shiftsRangeEnd.setMonth(shiftsRangeEnd.getMonth() + 4)
  shiftsRangeEnd.setDate(0)

  const [
    clockedInRes,
    hoursRes,
    openShiftsRes,
    expiringCredsRes,
    recentCheckInsRes,
    expiringFlagsRes,
  ] = await Promise.all([
    supabase
      .from('time_entries')
      .select('id, clock_in, volunteer:volunteers(id, first_name, last_name, category)')
      .is('clock_out', null)
      .order('clock_in', { ascending: true }),

    supabase
      .from('time_entries')
      .select('duration_minutes, clock_in, clock_out, volunteer:volunteers(id, first_name, last_name, category)')
      .gte('clock_in', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),

    supabase
      .from('shifts')
      .select('id, name, start_time, end_time, required_count, location:locations(name), shift_assignments(id)')
      .gte('start_time', shiftsRangeStart.toISOString())
      .lte('start_time', shiftsRangeEnd.toISOString())
      .order('start_time', { ascending: true }),


    supabase
      .from('credentials')
      .select('*, volunteer:volunteers(id, first_name, last_name)')
      .not('expiration_date', 'is', null)
      .lte('expiration_date', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])
      .gte('expiration_date', new Date().toISOString().split('T')[0])
      .order('expiration_date', { ascending: true })
      .limit(10),

    supabase
      .from('time_entries')
      .select('*, volunteer:volunteers(id, first_name, last_name, category), location:locations(name)')
      .order('clock_in', { ascending: false })
      .limit(8),

    supabase
      .from('volunteer_flags')
      .select('id, notes, raised_at, volunteer:volunteers(id, first_name, last_name), flag:org_flags(name)')
      .is('resolved_at', null),
  ])

  // Build open shifts list (upcoming shifts that aren't fully staffed)
  const openShifts: OpenShift[] = ((openShiftsRes.data ?? []) as unknown as {
    id: string; name: string; start_time: string; end_time: string
    required_count: number; location: { name: string } | null
    shift_assignments: unknown[]
  }[])
    .map(s => {
      const assigned = s.shift_assignments?.length ?? 0
      return {
        id: s.id,
        name: s.name,
        start_time: s.start_time,
        end_time: s.end_time,
        required_count: s.required_count,
        location_name: s.location?.name ?? null,
        assigned,
        spots_left: s.required_count - assigned,
      }
    })
    .filter(s => s.spots_left > 0)

  // Build per-volunteer hours breakdown; for still-clocked-in entries, compute live duration
  const nowMs = Date.now()
  const volMinutesMap = new Map<string, { id: string; first_name: string; last_name: string; category: string | null; minutes: number }>()
  let totalMinutes = 0

  for (const entry of (hoursRes.data ?? []) as unknown as {
    duration_minutes: number | null
    clock_in: string
    clock_out: string | null
    volunteer: { id: string; first_name: string; last_name: string; category: string | null } | null
  }[]) {
    const v = entry.volunteer
    if (!v) continue
    const minutes = entry.duration_minutes != null
      ? entry.duration_minutes
      : (nowMs - new Date(entry.clock_in).getTime()) / 60000
    totalMinutes += minutes
    const existing = volMinutesMap.get(v.id)
    if (existing) existing.minutes += minutes
    else volMinutesMap.set(v.id, { ...v, minutes })
  }

  const volunteerHoursBreakdown: VolunteerHours[] = Array.from(volMinutesMap.values())
    .map(v => ({ id: v.id, first_name: v.first_name, last_name: v.last_name, category: v.category, hours: Math.round(v.minutes / 60 * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours)

  const expiringCreds: ExpiringCred[] = ((expiringCredsRes.data ?? []) as unknown as ExpiringCred[]).map(c => ({
    ...c,
    days_until_expiry: Math.ceil(
      (new Date(c.expiration_date!).getTime() - Date.now()) / 86400000
    ),
  }))

  // Volunteers with an unresolved "Expiring Credentials" flag not already in expiringCreds
  const expiringCredVolIds = new Set(expiringCreds.map(c => c.volunteer.id))
  const flaggedExpiringVolunteers: FlaggedVolunteer[] = ((expiringFlagsRes.data ?? []) as unknown as {
    id: string
    notes: string | null
    raised_at: string
    volunteer: { id: string; first_name: string; last_name: string } | null
    flag: { name: string } | null
  }[])
    .filter(f => f.flag?.name === 'Expiring Credentials' && f.volunteer && !expiringCredVolIds.has(f.volunteer.id))
    .map(f => ({
      volunteer_id: f.volunteer!.id,
      first_name: f.volunteer!.first_name,
      last_name: f.volunteer!.last_name,
      notes: f.notes,
      raised_at: f.raised_at,
    }))

  const clockedInVolunteers = (clockedInRes.data ?? []) as unknown as ClockedInEntry[]

  const kpi: KpiData = {
    activeVolunteers: clockedInVolunteers.length,
    hoursThisMonth: Math.round(totalMinutes / 60),
    openShifts: openShifts.reduce((sum, s) => sum + s.spots_left, 0),
  }

  return {
    kpi,
    clockedInVolunteers,
    openShifts,
    volunteerHoursBreakdown,
    expiringCreds,
    flaggedExpiringVolunteers,
    recentCheckIns: (recentCheckInsRes.data ?? []) as unknown as CheckIn[],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  medical_professional: '#00897B',
  support_staff: '#3B82F6',
  admin: '#8B5CF6',
  trainee: '#F59E0B',
  other: '#6B7280',
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

function formatCheckInTime(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `Today ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + time
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
  sub?: string
}) {
  return (
    <div style={{
      background: 'var(--surface-card)',
      borderRadius: '12px',
      border: '1px solid var(--surface-border)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
    }}>
      {/* Accent top bar */}
      <div style={{ height: '3px', background: color, opacity: 0.75 }} />
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
          <div style={{
            width: '34px', height: '34px', borderRadius: '9px',
            background: `${color}15`,
            border: `1px solid ${color}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon style={{ width: '16px', height: '16px', color }} />
          </div>
        </div>
        <div>
          <span style={{
            fontSize: '28px', fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {value}
          </span>
          {sub && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '5px' }}>{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { kpi, clockedInVolunteers, openShifts, volunteerHoursBreakdown, expiringCreds, flaggedExpiringVolunteers, recentCheckIns } = await fetchDashboardData()

  const now = new Date()
  const monthName = now.toLocaleString('en-US', { month: 'long' })

  return (
    <div className="dash-page-content" style={{ padding: '32px', maxWidth: '1200px' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{
            fontSize: '22px', fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            marginBottom: '5px',
          }}>
            Dashboard
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px',
          background: 'rgba(0,137,123,0.08)',
          border: '1px solid rgba(0,137,123,0.16)',
          borderRadius: '20px',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00897B' }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#00897B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Live
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dash-stat-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '28px',
      }}>
        {/* Clocked In Now — custom card with name list */}
        <div style={{
          background: 'var(--surface-card)', borderRadius: '12px',
          border: '1px solid var(--surface-border)',
          boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}>
          <div style={{ height: '3px', background: '#1B2A4A', opacity: 0.75 }} />
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Clocked In Now</span>
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: '#1B2A4A15',
              border: '1px solid #1B2A4A22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Users style={{ width: '16px', height: '16px', color: '#1B2A4A' }} />
            </div>
          </div>
          <div>
            <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {kpi.activeVolunteers}
            </span>
            {clockedInVolunteers.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>No one on-site</p>
            ) : (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {clockedInVolunteers.slice(0, 5).map(entry => {
                  const v = entry.volunteer
                  if (!v) return null
                  const color = CATEGORY_COLORS[v.category ?? 'other'] ?? '#6B7280'
                  return (
                    <a
                      key={entry.id}
                      href={`/dashboard/volunteers/${v.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '7px',
                        textDecoration: 'none',
                      }}
                    >
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: `${color}20`, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '9px', fontWeight: 700, color,
                      }}>
                        {initials(v.first_name, v.last_name)}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                        {v.first_name} {v.last_name}
                      </span>
                    </a>
                  )
                })}
                {clockedInVolunteers.length > 5 && (
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                    +{clockedInVolunteers.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
          </div>
        </div>
        {/* Hours This Month — custom card with per-volunteer breakdown */}
        <div style={{
          background: 'var(--surface-card)', borderRadius: '12px',
          border: '1px solid var(--surface-border)',
          boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}>
          <div style={{ height: '3px', background: '#00897B', opacity: 0.75 }} />
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Hours in {monthName}</span>
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: '#00897B15',
              border: '1px solid #00897B22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Clock style={{ width: '16px', height: '16px', color: '#00897B' }} />
            </div>
          </div>
          <div>
            <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {kpi.hoursThisMonth}
            </span>
            {volunteerHoursBreakdown.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>No hours logged yet</p>
            ) : (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {volunteerHoursBreakdown.slice(0, 5).map(v => {
                  const color = CATEGORY_COLORS[v.category ?? 'other'] ?? '#6B7280'
                  return (
                    <a
                      key={v.id}
                      href={`/dashboard/volunteers/${v.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '7px', textDecoration: 'none' }}
                    >
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: `${color}20`, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '9px', fontWeight: 700, color,
                      }}>
                        {initials(v.first_name, v.last_name)}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.first_name} {v.last_name}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#00897B', flexShrink: 0 }}>
                        {v.hours}h
                      </span>
                    </a>
                  )
                })}
                {volunteerHoursBreakdown.length > 5 && (
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                    +{volunteerHoursBreakdown.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
          </div>
        </div>
        {/* Open Shifts — custom card with shift list */}
        <div style={{
          background: 'var(--surface-card)', borderRadius: '12px',
          border: '1px solid var(--surface-border)',
          boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}>
          <div style={{ height: '3px', background: '#F59E0B', opacity: 0.75 }} />
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Open Shifts</span>
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: '#F59E0B15',
              border: '1px solid #F59E0B22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CalendarDays style={{ width: '16px', height: '16px', color: '#F59E0B' }} />
            </div>
          </div>
          <div>
            <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {kpi.openShifts}
            </span>
            {openShifts.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>All shifts filled</p>
            ) : (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {openShifts.slice(0, 4).map(shift => {
                  const start = new Date(shift.start_time)
                  const isToday = start.toDateString() === new Date().toDateString()
                  const dateLabel = isToday
                    ? `Today ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                    : start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
                      ' ' + start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  return (
                    <a
                      key={shift.id}
                      href="/dashboard/shifts"
                      style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '1px' }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#1B2A4A', lineHeight: 1.3 }}>
                        {shift.name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {dateLabel}
                        {shift.location_name && (
                          <><span style={{ color: '#e5e7eb' }}>·</span>{shift.location_name}</>
                        )}
                        <span style={{
                          fontSize: '10px', fontWeight: 600,
                          padding: '1px 5px', borderRadius: '4px',
                          background: '#FEF3C7', color: '#92400E',
                        }}>
                          {shift.spots_left} spot{shift.spots_left !== 1 ? 's' : ''} open
                        </span>
                      </span>
                    </a>
                  )
                })}
                {openShifts.length > 4 && (
                  <a href="/dashboard/shifts" style={{ fontSize: '11px', color: '#9ca3af', textDecoration: 'none', marginTop: '1px' }}>
                    +{openShifts.length - 4} more →
                  </a>
                )}
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Lower grid: table + feed */}
      <div className="dash-lower-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>

        {/* Expiring Credentials */}
        <div style={{
          background: 'var(--surface-card)', borderRadius: '12px',
          border: '1px solid var(--surface-border)',
          boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 24px', borderBottom: '1px solid var(--surface-border-sub)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle style={{ width: '15px', height: '15px', color: '#F59E0B' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                Expiring Credentials
              </span>
              <span style={{
                fontSize: '11px', background: '#FEF3C7', color: '#92400E',
                padding: '2px 7px', borderRadius: '10px', fontWeight: 500,
              }}>Next 30 days</span>
              {flaggedExpiringVolunteers.length > 0 && (
                <span style={{
                  fontSize: '11px', background: '#fef2f2', color: '#dc2626',
                  padding: '2px 7px', borderRadius: '10px', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                }}>
                  <AlertTriangle style={{ width: '10px', height: '10px' }} />
                  {flaggedExpiringVolunteers.length} flagged
                </span>
              )}
            </div>
            <a href="/dashboard/reports?tab=credentials" style={{ fontSize: '12px', color: '#00897B', textDecoration: 'none', fontWeight: 500 }}>
              View all →
            </a>
          </div>

          {expiringCreds.length === 0 && flaggedExpiringVolunteers.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <TrendingUp style={{ width: '28px', height: '28px', color: '#d1fae5', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '14px', color: '#6b7280' }}>No credentials expiring in the next 30 days</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Volunteer', 'Credential Type', 'Expires', 'Days Left'].map(h => (
                    <th key={h} style={{
                      padding: '10px 24px', textAlign: 'left',
                      fontSize: '11px', fontWeight: 600, color: '#9ca3af',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expiringCreds.map((c, i) => (
                  <tr key={c.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f9f9f9' }}>
                    <td style={{ padding: '12px 24px' }}>
                      <a href={`/dashboard/volunteers/${c.volunteer.id}`} style={{ fontSize: '13px', fontWeight: 500, color: '#1B2A4A', textDecoration: 'none' }}>
                        {c.volunteer.first_name} {c.volunteer.last_name}
                      </a>
                    </td>
                    <td style={{ padding: '12px 24px', fontSize: '13px', color: '#374151' }}>{c.type}</td>
                    <td style={{ padding: '12px 24px', fontSize: '13px', color: '#374151' }}>
                      {new Date(c.expiration_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 24px' }}>
                      <span style={{
                        fontSize: '12px', fontWeight: 600,
                        padding: '3px 8px', borderRadius: '6px',
                        background: c.days_until_expiry <= 7 ? '#fef2f2' : c.days_until_expiry <= 14 ? '#fff7ed' : '#fefce8',
                        color:      c.days_until_expiry <= 7 ? '#dc2626' : c.days_until_expiry <= 14 ? '#ea580c' : '#ca8a04',
                      }}>
                        {c.days_until_expiry}d
                      </span>
                    </td>
                  </tr>
                ))}
                {flaggedExpiringVolunteers.map((v, i) => (
                  <tr key={v.volunteer_id} style={{ borderTop: (expiringCreds.length > 0 || i > 0) ? '1px solid #f9f9f9' : 'none' }}>
                    <td style={{ padding: '12px 24px' }}>
                      <a href={`/dashboard/volunteers/${v.volunteer_id}`} style={{ fontSize: '13px', fontWeight: 500, color: '#1B2A4A', textDecoration: 'none' }}>
                        {v.first_name} {v.last_name}
                      </a>
                    </td>
                    <td style={{ padding: '12px 24px', fontSize: '13px', color: '#374151' }}>
                      {v.notes ?? '—'}
                    </td>
                    <td style={{ padding: '12px 24px', fontSize: '13px', color: '#9ca3af' }}>—</td>
                    <td style={{ padding: '12px 24px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 600,
                        padding: '3px 8px', borderRadius: '6px',
                        background: '#fef2f2', color: '#dc2626',
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                      }}>
                        <AlertTriangle style={{ width: '10px', height: '10px' }} />
                        Flagged
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Check-ins */}
        <div style={{
          background: 'var(--surface-card)', borderRadius: '12px',
          border: '1px solid var(--surface-border)',
          boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 20px', borderBottom: '1px solid var(--surface-border-sub)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Activity style={{ width: '15px', height: '15px', color: '#00897B' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Recent Check-ins</span>
          </div>

          <div style={{ padding: '4px 0' }}>
            {recentCheckIns.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#9ca3af' }}>No recent check-ins</p>
              </div>
            ) : recentCheckIns.map(entry => {
              const cat = entry.volunteer?.category ?? 'other'
              const color = CATEGORY_COLORS[cat] ?? '#6B7280'
              return (
                <div key={entry.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 20px',
                }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: `${color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color, flexShrink: 0,
                  }}>
                    {initials(entry.volunteer?.first_name ?? '?', entry.volunteer?.last_name ?? '?')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', marginBottom: '1px' }}>
                      {entry.volunteer?.first_name} {entry.volunteer?.last_name}
                    </p>
                    {entry.location && (
                      <p style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <MapPin style={{ width: '10px', height: '10px' }} />
                        {entry.location.name}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>
                      {formatCheckInTime(entry.clock_in)}
                    </p>
                    <span style={{
                      fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px',
                      background: entry.clock_out ? '#f0fdf4' : '#fef3c7',
                      color:      entry.clock_out ? '#16a34a' : '#92400e',
                    }}>
                      {entry.clock_out ? 'Clocked out' : 'Active'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {recentCheckIns.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f9f9f9' }}>
              <a href="/dashboard/shifts" style={{
                fontSize: '12px', color: '#00897B', textDecoration: 'none', fontWeight: 500,
              }}>
                View all shifts →
              </a>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
