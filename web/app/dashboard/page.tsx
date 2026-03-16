import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import {
  Users, Clock, CalendarDays, ClipboardList,
  AlertTriangle, TrendingUp, MapPin, Activity
} from 'lucide-react'
import type { Volunteer, Credential, TimeEntry, Location } from '@/types/database'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  activeVolunteers: number
  hoursThisMonth: number
  openShifts: number
  pendingOnboarding: number
}

interface ExpiringCred extends Credential {
  volunteer: Pick<Volunteer, 'id' | 'first_name' | 'last_name'>
  days_until_expiry: number
}

interface CheckIn extends TimeEntry {
  volunteer: Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'category'>
  location: Pick<Location, 'name'> | null
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchDashboardData() {
  noStore()
  const supabase = createAdminClient()

  const [
    volunteersRes,
    hoursRes,
    openShiftsRes,
    pendingOnboardingRes,
    expiringCredsRes,
    recentCheckInsRes,
  ] = await Promise.all([
    supabase
      .from('volunteers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),

    supabase
      .from('time_entries')
      .select('duration_minutes')
      .gte('clock_in', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),

    supabase
      .from('shifts')
      .select('id, required_count, shift_assignments(id)')
      .gte('start_time', new Date().toISOString()),

    supabase
      .from('onboarding_progress')
      .select('id', { count: 'exact', head: true })
      .is('completed_at', null),

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
  ])

  // Compute open shifts (assignments < required_count)
  const openShifts = ((openShiftsRes.data ?? []) as { required_count: number; shift_assignments: unknown[] }[])
    .filter(s => (s.shift_assignments?.length ?? 0) < s.required_count).length

  const totalMinutes = ((hoursRes.data ?? []) as { duration_minutes: number | null }[])
    .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0)

  const expiringCreds: ExpiringCred[] = ((expiringCredsRes.data ?? []) as ExpiringCred[]).map(c => ({
    ...c,
    days_until_expiry: Math.ceil(
      (new Date(c.expiration_date!).getTime() - Date.now()) / 86400000
    ),
  }))

  const kpi: KpiData = {
    activeVolunteers: volunteersRes.count ?? 0,
    hoursThisMonth: Math.round(totalMinutes / 60),
    openShifts,
    pendingOnboarding: pendingOnboardingRes.count ?? 0,
  }

  return {
    kpi,
    expiringCreds,
    recentCheckIns: (recentCheckInsRes.data ?? []) as CheckIn[],
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
      background: 'white',
      borderRadius: '12px',
      border: '1px solid #f0f0f0',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>{label}</span>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: `${color}1a`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: '17px', height: '17px', color }} />
        </div>
      </div>
      <div>
        <span style={{ fontSize: '28px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
          {value}
        </span>
        {sub && <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { kpi, expiringCreds, recentCheckIns } = await fetchDashboardData()

  const now = new Date()
  const monthName = now.toLocaleString('en-US', { month: 'long' })

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
          Dashboard
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <KpiCard label="Active Volunteers" value={kpi.activeVolunteers} icon={Users}         color="#1B2A4A" sub="Currently active" />
        <KpiCard label={`Hours in ${monthName}`} value={kpi.hoursThisMonth} icon={Clock}    color="#00897B" sub="Across all locations" />
        <KpiCard label="Open Shifts"          value={kpi.openShifts}        icon={CalendarDays} color="#F59E0B" sub="Upcoming, unfilled" />
        <KpiCard label="Pending Steps"        value={kpi.pendingOnboarding} icon={ClipboardList} color="#3B82F6" sub="Onboarding actions" />
      </div>

      {/* Lower grid: table + feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>

        {/* Expiring Credentials */}
        <div style={{
          background: 'white', borderRadius: '12px',
          border: '1px solid #f0f0f0', overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 24px', borderBottom: '1px solid #f9f9f9',
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
            </div>
            <a href="/dashboard/volunteers" style={{ fontSize: '12px', color: '#00897B', textDecoration: 'none', fontWeight: 500 }}>
              View all →
            </a>
          </div>

          {expiringCreds.length === 0 ? (
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
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Check-ins */}
        <div style={{
          background: 'white', borderRadius: '12px',
          border: '1px solid #f0f0f0', overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 20px', borderBottom: '1px solid #f9f9f9',
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
