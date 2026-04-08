'use client'

import { useState, useMemo, useTransition } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Download, TrendingUp, Clock, ShieldCheck, AlertTriangle, UserX, Filter, X } from 'lucide-react'
import type { HoursRow, OnboardingRow, PipelinePhaseCount, VolunteerOnboardingRow, BgCheckRow, CredentialExpiryRow, ActiveVolunteerActivity, FilterParams } from './page'
import { bulkMarkInactive, approveHoursEntry, rejectHoursEntry } from './actions'
import type { Category } from '@/types/database'
import { useAdminT } from '@/lib/admin-lang'

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY = '#1B2A4A'

const PIPELINE_PHASE_LABELS: Record<string, string> = {
  intake:       'Intake',
  orientation:  'Orientation',
  review:       'Review',
  training:     'Training',
  active:       'Active',
  offboarding:  'Offboarding',
}

const PIPELINE_PHASE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  intake:      { bg: '#f3f4f6', text: '#374151', bar: '#9ca3af' },
  orientation: { bg: '#eff6ff', text: '#1e40af', bar: '#3b82f6' },
  review:      { bg: '#fef3c7', text: '#92400e', bar: '#f59e0b' },
  training:    { bg: '#fdf4ff', text: '#6b21a8', bar: '#a855f7' },
  active:      { bg: '#f0fdf4', text: '#15803d', bar: '#22c55e' },
  offboarding: { bg: '#fef2f2', text: '#991b1b', bar: '#ef4444' },
}


const BG_RESULT_COLORS: Record<string, { bg: string; text: string }> = {
  clear:     { bg: '#f0fdf4', text: '#15803d' },
  consider:  { bg: '#fff7ed', text: '#ea580c' },
  suspended: { bg: '#fef2f2', text: '#dc2626' },
  pending:   { bg: '#eff6ff', text: '#1d4ed8' },
}

// ─── CSV helper ───────────────────────────────────────────────────────────────

function downloadCSV(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Tab types ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'hours',      label: 'Hours',             icon: Clock },
  { key: 'onboarding', label: 'Onboarding',         icon: TrendingUp },
  { key: 'bgchecks',   label: 'Background Checks',  icon: ShieldCheck },
  { key: 'credentials',label: 'Credential Expiry',  icon: AlertTriangle },
  { key: 'inactive',   label: 'Inactive',           icon: UserX },
] as const

type Tab = typeof TABS[number]['key']

// ─── Component ────────────────────────────────────────────────────────────────

const PIPELINE_PHASES_LIST = ['intake', 'orientation', 'review', 'training', 'active', 'offboarding']

function GlobalFilterBar({ allCategories, allStatuses, appliedFilters, categories }: {
  allCategories: string[]
  allStatuses: string[]
  appliedFilters: FilterParams
  categories: Category[]
}) {
  const t = useAdminT()
  function getCatLabel(slug: string) {
    return categories.find(c => c.slug === slug)?.name ?? slug
  }

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState(appliedFilters.status ?? '')
  const [category, setCategory] = useState(appliedFilters.category ?? '')
  const [dateFrom, setDateFrom] = useState(appliedFilters.dateFrom ?? '')
  const [dateTo, setDateTo] = useState(appliedFilters.dateTo ?? '')
  const [pipelinePhase, setPipelinePhase] = useState(appliedFilters.pipelinePhase ?? '')
  const [open, setOpen] = useState(
    !!(appliedFilters.status || appliedFilters.category || appliedFilters.dateFrom || appliedFilters.dateTo || appliedFilters.pipelinePhase)
  )

  const activeCount = [appliedFilters.status, appliedFilters.category, appliedFilters.dateFrom, appliedFilters.dateTo, appliedFilters.pipelinePhase].filter(Boolean).length

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString())
    if (status)        params.set('status', status);       else params.delete('status')
    if (category)      params.set('category', category);   else params.delete('category')
    if (dateFrom)      params.set('dateFrom', dateFrom);   else params.delete('dateFrom')
    if (dateTo)        params.set('dateTo', dateTo);       else params.delete('dateTo')
    if (pipelinePhase) params.set('pipelinePhase', pipelinePhase); else params.delete('pipelinePhase')
    router.push(`${pathname}?${params.toString()}`)
  }

  function clearFilters() {
    setStatus(''); setCategory(''); setDateFrom(''); setDateTo(''); setPipelinePhase('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('status'); params.delete('category'); params.delete('dateFrom'); params.delete('dateTo'); params.delete('pipelinePhase')
    router.push(`${pathname}?${params.toString()}`)
  }

  const iStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 7, border: '1px solid #e5e7eb',
    fontSize: '13px', color: '#374151', fontFamily: 'inherit', background: 'white',
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
          border: `1px solid ${activeCount > 0 ? '#1B2A4A' : '#e5e7eb'}`,
          background: activeCount > 0 ? '#f0f4fa' : 'white',
          color: activeCount > 0 ? '#1B2A4A' : '#374151',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <Filter size={13} />
        {t('filters')}
        {activeCount > 0 && (
          <span style={{
            background: '#1B2A4A', color: 'white', fontSize: '10px', fontWeight: 700,
            borderRadius: '50%', width: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{activeCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          marginTop: 8, padding: '14px 18px',
          background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
          display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('status_filter')}</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={iStyle}>
              <option value="">{t('all')}</option>
              {allStatuses.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('category_filter')}</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={iStyle}>
              <option value="">{t('all')}</option>
              {allCategories.map(c => <option key={c} value={c}>{getCatLabel(c)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pipeline_phase_filter')}</label>
            <select value={pipelinePhase} onChange={e => setPipelinePhase(e.target.value)} style={iStyle}>
              <option value="">{t('all')}</option>
              {PIPELINE_PHASES_LIST.map(p => <option key={p} value={p}>{PIPELINE_PHASE_LABELS[p] ?? p}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('joined_from')}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={iStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('joined_to')}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={iStyle} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={applyFilters} style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 600, background: '#1B2A4A', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{t('apply')}</button>
            {activeCount > 0 && (
              <button onClick={clearFilters} style={{ padding: '6px 10px', borderRadius: '7px', fontSize: '13px', background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={12} /> {t('clear')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface PendingHoursEntry {
  id: string
  volunteer_name: string
  clock_in: string
  clock_out: string
  hours: number
}

function MedVolPendingHoursPanel({ entries }: { entries: PendingHoursEntry[] }) {
  const t = useAdminT()
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const [items, setItems] = useState(entries)

  function handleApprove(id: string) {
    setItems(i => i.filter(e => e.id !== id))
    startTransition(async () => { await approveHoursEntry(id); router.refresh() })
  }

  function handleReject(id: string) {
    setItems(i => i.filter(e => e.id !== id))
    startTransition(async () => { await rejectHoursEntry(id); router.refresh() })
  }

  if (items.length === 0) return <p style={{ fontSize: 13, color: '#9ca3af' }}>{t('no_pending_hours')}</p>

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>{t('volunteer')}</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>{t('clock_in_col')}</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>{t('clock_out_col')}</th>
          <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>{t('shift_hours')}</th>
          <th style={{ padding: '8px 12px' }} />
        </tr>
      </thead>
      <tbody>
        {items.map(e => (
          <tr key={e.id} style={{ borderBottom: '1px solid #f9fafb' }}>
            <td style={{ padding: '8px 12px', color: '#111827', fontWeight: 500 }}>{e.volunteer_name}</td>
            <td style={{ padding: '8px 12px', color: '#374151' }} suppressHydrationWarning>{new Date(e.clock_in).toLocaleString()}</td>
            <td style={{ padding: '8px 12px', color: '#374151' }} suppressHydrationWarning>{new Date(e.clock_out).toLocaleString()}</td>
            <td style={{ padding: '8px 12px', color: '#374151', textAlign: 'right' }}>{e.hours}h</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => handleApprove(e.id)} disabled={pending} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer' }}>{t('approve')}</button>
                <button onClick={() => handleReject(e.id)} disabled={pending} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>{t('reject')}</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const PALETTE: Record<number, { bg: string; text: string }> = {
  0: { bg: '#d1fae5', text: '#065f46' },
  1: { bg: '#dbeafe', text: '#1e40af' },
  2: { bg: '#ede9fe', text: '#5b21b6' },
  3: { bg: '#fef3c7', text: '#92400e' },
  4: { bg: '#f0f9ff', text: '#0369a1' },
  5: { bg: '#fff1f2', text: '#be123c' },
  6: { bg: '#fefce8', text: '#a16207' },
  7: { bg: '#f3f4f6', text: '#374151' },
}

export default function ReportsView({
  hoursRows,
  onboardingRows,
  pipelineStats,
  volunteerOnboardingRows,
  bgRows,
  credRows,
  activeVolunteerActivity = [],
  allCategories = [],
  allStatuses = [],
  appliedFilters = {},
  requireHourApproval = false,
  pendingHours = [],
  categories = [],
}: {
  hoursRows: HoursRow[]
  onboardingRows: OnboardingRow[]
  pipelineStats: PipelinePhaseCount[]
  volunteerOnboardingRows: VolunteerOnboardingRow[]
  bgRows: BgCheckRow[]
  credRows: CredentialExpiryRow[]
  activeVolunteerActivity?: ActiveVolunteerActivity[]
  allCategories?: string[]
  allStatuses?: string[]
  appliedFilters?: FilterParams
  requireHourApproval?: boolean
  pendingHours?: PendingHoursEntry[]
  categories?: Category[]
}) {
  const t = useAdminT()
  function getCatLabel(slug: string) {
    return categories.find(c => c.slug === slug)?.name ?? slug
  }
  function getCatStyle(slug: string) {
    const idx = categories.findIndex(c => c.slug === slug)
    if (idx === -1) return { bg: '#f3f4f6', text: '#6b7280' }
    return PALETTE[idx % 8]
  }
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'hours'
  const [activeTab, setActiveTab] = useState<Tab>(
    TABS.some(t => t.key === initialTab) ? initialTab : 'hours'
  )

  // Hours filters
  const [hoursSearch, setHoursSearch]     = useState('')
  const [hoursCategory, setHoursCategory] = useState('')

  const filteredHours = useMemo(() => {
    let rows = [...hoursRows]
    if (hoursSearch)   rows = rows.filter(r => r.name.toLowerCase().includes(hoursSearch.toLowerCase()))
    if (hoursCategory) rows = rows.filter(r => r.category === hoursCategory)
    return rows
  }, [hoursRows, hoursSearch, hoursCategory])

  const totalHours = filteredHours.reduce((s, r) => s + r.total_minutes, 0) / 60

  // Onboarding volunteer filter
  const [onboardingSearch, setOnboardingSearch]   = useState('')
  const [onboardingPhase, setOnboardingPhase]     = useState('')

  const filteredOnboardingVols = useMemo(() => {
    let rows = [...volunteerOnboardingRows]
    if (onboardingSearch) rows = rows.filter(r => r.name.toLowerCase().includes(onboardingSearch.toLowerCase()))
    if (onboardingPhase)  rows = rows.filter(r => r.pipeline_phase === onboardingPhase)
    return rows
  }, [volunteerOnboardingRows, onboardingSearch, onboardingPhase])

  // Cred expiry window filter
  const [credWindow, setCredWindow] = useState<30 | 60 | 90>(90)
  const filteredCreds = credRows.filter(r => r.days_until_expiry <= credWindow)

  // Inactive volunteers
  const [inactiveThreshold, setInactiveThreshold] = useState<30 | 60 | 90 | 'custom'>(60)
  const [inactiveCustomDays, setInactiveCustomDays] = useState('')
  const [inactiveSelected, setInactiveSelected] = useState<Set<string>>(new Set())
  const [inactivePending, startInactiveTransition] = useTransition()
  const [inactiveError, setInactiveError] = useState<string | null>(null)
  const [inactiveSuccessCount, setInactiveSuccessCount] = useState<number | null>(null)

  const inactiveDays = inactiveThreshold === 'custom' ? parseInt(inactiveCustomDays, 10) || 0 : inactiveThreshold
  const inactiveCutoff = inactiveDays > 0 ? new Date(Date.now() - inactiveDays * 86400000).toISOString() : null

  const inactiveVols = useMemo(() => {
    if (!inactiveCutoff) return []
    return activeVolunteerActivity.filter(v =>
      !v.lastActivityAt || v.lastActivityAt < inactiveCutoff
    )
  }, [activeVolunteerActivity, inactiveCutoff])

  const thStyle: React.CSSProperties = {
    padding: '10px 20px', textAlign: 'left',
    fontSize: '11px', fontWeight: 600, color: '#9ca3af',
    letterSpacing: '0.06em', textTransform: 'uppercase',
  }

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '8px',
    fontSize: '13px', color: '#374151', background: 'white',
    cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none',
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '8px',
    fontSize: '13px', color: '#374151', outline: 'none', background: 'white',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

      {/* Global Filters */}
      <GlobalFilterBar allCategories={allCategories} allStatuses={allStatuses} appliedFilters={appliedFilters} categories={categories} />

      {/* Pending Hours */}
      {requireHourApproval && (
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{t('pending_hour_approvals')}</span>
            {pendingHours.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#fef2f2', color: '#dc2626' }}>{pendingHours.length}</span>
            )}
          </div>
          <MedVolPendingHoursPanel entries={pendingHours} />
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '24px',
        borderBottom: '1px solid #f0f0f0', paddingBottom: '0',
      }}>
        {TABS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 16px', border: 'none', background: 'none',
              fontSize: '13px', fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? NAVY : '#6b7280',
              cursor: 'pointer',
              borderBottom: activeTab === key ? `2px solid ${NAVY}` : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'all 0.15s',
            }}
          >
            <Icon style={{ width: '13px', height: '13px' }} />
            {t(`${key}_tab`)}
          </button>
        ))}
      </div>

      {/* ── Hours ──────────────────────────────────────────────── */}
      {activeTab === 'hours' && (
        <div>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
            {[
              { label: 'Total Hours',    value: totalHours.toFixed(1) },
              { label: 'Volunteers',     value: filteredHours.length },
              { label: 'Avg per Person', value: filteredHours.length ? (totalHours / filteredHours.length).toFixed(1) : '0' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: 'white', borderRadius: '10px', border: '1px solid #f0f0f0',
                padding: '16px 20px',
              }}>
                <p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>{value}h</p>
              </div>
            ))}
          </div>

          {/* Filters + export */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              style={inputStyle}
              placeholder="Search by name…"
              value={hoursSearch}
              onChange={e => setHoursSearch(e.target.value)}
            />
            <select style={selectStyle} value={hoursCategory} onChange={e => setHoursCategory(e.target.value)}>
              <option value="">{t('all_categories')}</option>
              {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <button
              onClick={() => downloadCSV(
                filteredHours.map(r => ({
                  Name: r.name,
                  Category: getCatLabel(r.category),
                  'Total Hours': (r.total_minutes / 60).toFixed(2),
                  Sessions: r.session_count,
                })),
                'hours-report.csv'
              )}
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px',
                background: NAVY, color: 'white', border: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              }}
            >
              <Download style={{ width: '13px', height: '13px' }} />
              {t('export_csv')}
            </button>
          </div>

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
            {filteredHours.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <Clock style={{ width: '28px', height: '28px', color: '#e5e7eb', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>{t('no_hours_found')}</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={thStyle}>{t('volunteer')}</th>
                    <th style={thStyle}>{t('category_filter')}</th>
                    <th style={thStyle}>{t('sessions_col')}</th>
                    <th style={thStyle}>{t('total_hours_report')}</th>
                    <th style={thStyle}>{t('distribution_col')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHours.map((r, i) => {
                    const catStyle = getCatStyle(r.category)
                    const maxMins  = hoursRows[0]?.total_minutes ?? 1
                    const pct      = Math.round((r.total_minutes / maxMins) * 100)
                    return (
                      <tr key={r.volunteer_id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{r.name}</td>
                        <td style={{ padding: '12px 20px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px', background: catStyle.bg, color: catStyle.text }}>
                            {getCatLabel(r.category)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 20px', fontSize: '13px', color: '#374151' }}>{r.session_count}</td>
                        <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                          {(r.total_minutes / 60).toFixed(1)}h
                        </td>
                        <td style={{ padding: '12px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '120px', height: '6px', borderRadius: '3px', background: '#f3f4f6', overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: '3px', background: NAVY, width: `${pct}%` }} />
                            </div>
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Onboarding ─────────────────────────────────────────── */}
      {activeTab === 'onboarding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Pipeline phase breakdown */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              Pipeline Phases
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
              {pipelineStats.map(({ phase, count }) => {
                const c = PIPELINE_PHASE_COLORS[phase] ?? PIPELINE_PHASE_COLORS.intake
                const total = volunteerOnboardingRows.length
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={phase} style={{
                    background: 'white', borderRadius: '10px', border: '1px solid #f0f0f0',
                    padding: '14px 16px',
                  }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                      {PIPELINE_PHASE_LABELS[phase]}
                    </p>
                    <p style={{ fontSize: '26px', fontWeight: 700, color: '#111827', lineHeight: 1, marginBottom: '8px' }}>{count}</p>
                    <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '2px', background: c.bar, width: `${pct}%`, transition: 'width 0.4s ease' }} />
                    </div>
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{pct}%</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {(() => {
              const total    = volunteerOnboardingRows.length
              const active   = volunteerOnboardingRows.filter(r => r.pipeline_phase === 'active').length
              const complete = volunteerOnboardingRows.filter(r => r.completion_pct === 100).length
              const avgPct   = total > 0
                ? Math.round(volunteerOnboardingRows.reduce((s, r) => s + r.completion_pct, 0) / total)
                : 0
              return [
                { label: 'Total Volunteers', value: total, suffix: '' },
                { label: 'Workflow Complete', value: complete, suffix: '' },
                { label: 'Avg Completion', value: avgPct, suffix: '%' },
              ].map(({ label, value, suffix }) => (
                <div key={label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #f0f0f0', padding: '16px 20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</p>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>{value}{suffix}</p>
                </div>
              ))
            })()}
          </div>

          {/* Workflow completion cards */}
          {onboardingRows.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                Workflow Completion
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {onboardingRows.map(row => {
                  const catStyle = row.category ? getCatStyle(row.category) : { bg: '#f3f4f6', text: '#374151' }
                  return (
                    <div key={row.workflow_id} style={{
                      background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', padding: '18px 22px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{row.workflow_name}</h3>
                          <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '5px', background: catStyle.bg, color: catStyle.text }}>
                            {row.category ? getCatLabel(row.category) : 'All categories'}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '26px', fontWeight: 700, color: row.completion_rate === 100 ? '#16a34a' : NAVY }}>
                            {row.completion_rate}%
                          </p>
                          <p style={{ fontSize: '12px', color: '#9ca3af' }}>{row.fully_complete} of {row.total_volunteers} complete</p>
                        </div>
                      </div>
                      <div style={{ height: '7px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '4px', transition: 'width 0.4s ease',
                          background: row.completion_rate === 100 ? '#22c55e' : row.completion_rate >= 60 ? NAVY : '#f59e0b',
                          width: `${row.completion_rate}%`,
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{row.total_volunteers} enrolled</span>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{row.total_volunteers - row.fully_complete} in progress</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Per-volunteer progress table */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Volunteer Progress
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  style={inputStyle}
                  placeholder="Search by name…"
                  value={onboardingSearch}
                  onChange={e => setOnboardingSearch(e.target.value)}
                />
                <select style={selectStyle} value={onboardingPhase} onChange={e => setOnboardingPhase(e.target.value)}>
                  <option value="">{t('all_phases')}</option>
                  {Object.entries(PIPELINE_PHASE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button
                  onClick={() => downloadCSV(
                    filteredOnboardingVols.map(r => ({
                      Name: r.name,
                      Category: getCatLabel(r.category),
                      'Pipeline Phase': PIPELINE_PHASE_LABELS[r.pipeline_phase] ?? r.pipeline_phase,
                      Workflow: r.workflow_name ?? '—',
                      'Stages Completed': r.stages_completed,
                      'Stages Total': r.stages_total,
                      'Completion %': r.completion_pct,
                    })),
                    'onboarding-progress.csv'
                  )}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '8px',
                    background: NAVY, color: 'white', border: 'none',
                    cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  }}
                >
                  <Download style={{ width: '13px', height: '13px' }} />
                  {t('export_csv')}
                </button>
              </div>
            </div>

            {filteredOnboardingVols.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
                <TrendingUp style={{ width: '28px', height: '28px', color: '#e5e7eb', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>{t('no_volunteers_filter')}</p>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={thStyle}>{t('volunteer')}</th>
                      <th style={thStyle}>{t('category_filter')}</th>
                      <th style={thStyle}>{t('phase_col')}</th>
                      <th style={thStyle}>{t('workflow_col')}</th>
                      <th style={thStyle}>{t('stages_col')}</th>
                      <th style={thStyle}>{t('progress_col')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOnboardingVols.map((r, i) => {
                      const catStyle   = getCatStyle(r.category)
                      const phaseStyle = PIPELINE_PHASE_COLORS[r.pipeline_phase] ?? PIPELINE_PHASE_COLORS.intake
                      const pct        = r.completion_pct
                      const barColor   = pct === 100 ? '#22c55e' : pct >= 60 ? NAVY : '#f59e0b'
                      return (
                        <tr key={r.volunteer_id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f9f9f9' }}>
                          <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{r.name}</td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px', background: catStyle.bg, color: catStyle.text }}>
                              {getCatLabel(r.category)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px', background: phaseStyle.bg, color: phaseStyle.text }}>
                              {PIPELINE_PHASE_LABELS[r.pipeline_phase] ?? r.pipeline_phase}
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px', fontSize: '13px', color: '#374151' }}>{r.workflow_name ?? '—'}</td>
                          <td style={{ padding: '12px 20px', fontSize: '13px', color: '#374151' }}>
                            {r.stages_total > 0 ? `${r.stages_completed} / ${r.stages_total}` : '—'}
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            {r.stages_total > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '100px', height: '6px', borderRadius: '3px', background: '#f3f4f6', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', borderRadius: '3px', background: barColor, width: `${pct}%` }} />
                                </div>
                                <span style={{ fontSize: '11px', color: '#9ca3af', minWidth: '32px' }}>{pct}%</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#d1d5db' }}>{t('no_workflow_assigned')}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Background Checks ──────────────────────────────────── */}
      {activeTab === 'bgchecks' && (
        <div>
          {bgRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px', background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <ShieldCheck style={{ width: '28px', height: '28px', color: '#e5e7eb', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>{t('no_bgcheck_data')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
              {bgRows.map(row => {
                const key    = row.result ?? row.status
                const colors = BG_RESULT_COLORS[key] ?? { bg: '#f3f4f6', text: '#374151' }
                const total  = bgRows.reduce((s, r) => s + r.count, 0)
                const pct    = Math.round((row.count / total) * 100)
                return (
                  <div key={key} style={{
                    background: colors.bg, borderRadius: '12px',
                    border: `1px solid ${colors.bg}`,
                    padding: '20px 24px',
                  }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </p>
                    <p style={{ fontSize: '36px', fontWeight: 700, color: colors.text, lineHeight: 1 }}>{row.count}</p>
                    <p style={{ fontSize: '12px', color: colors.text, opacity: 0.7, marginTop: '4px' }}>{pct}% of total</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Inactive Volunteers ─────────────────────────────────── */}
      {activeTab === 'inactive' && (
        <div>
          {/* Threshold selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>{t('no_activity_in_last')}</span>
            {([30, 60, 90] as const).map(d => (
              <button
                key={d}
                onClick={() => setInactiveThreshold(d)}
                style={{
                  padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 500,
                  background: inactiveThreshold === d ? NAVY : '#f3f4f6',
                  color: inactiveThreshold === d ? 'white' : '#6b7280',
                }}
              >{d} {t('days_suffix')}</button>
            ))}
            <button
              onClick={() => setInactiveThreshold('custom')}
              style={{
                padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 500,
                background: inactiveThreshold === 'custom' ? NAVY : '#f3f4f6',
                color: inactiveThreshold === 'custom' ? 'white' : '#6b7280',
              }}
            >{t('custom_days')}</button>
            {inactiveThreshold === 'custom' && (
              <input
                type="number" min="1" placeholder="Days" value={inactiveCustomDays}
                onChange={e => setInactiveCustomDays(e.target.value)}
                style={{ ...inputStyle, width: 80 }}
              />
            )}
          </div>

          {inactiveError && <p style={{ fontSize: '13px', color: '#dc2626', marginBottom: '12px' }}>{inactiveError}</p>}
          {inactiveSuccessCount !== null && (
            <p style={{ fontSize: '13px', color: '#059669', marginBottom: '12px' }}>
              {inactiveSuccessCount} volunteer{inactiveSuccessCount !== 1 ? 's' : ''} marked inactive.
            </p>
          )}

          {inactiveDays === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px', background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <UserX style={{ width: '28px', height: '28px', color: '#e5e7eb', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>{t('set_day_threshold')}</p>
            </div>
          ) : inactiveVols.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px', background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <UserX style={{ width: '28px', height: '28px', color: '#d1fae5', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '14px', color: '#6b7280' }}>{t('no_inactive_volunteers')} {inactiveDays}+ {t('days_suffix')}</p>
            </div>
          ) : (
            <>
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden', marginBottom: '14px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ ...thStyle, width: '36px' }}>
                        <input
                          type="checkbox"
                          checked={inactiveSelected.size === inactiveVols.length}
                          onChange={() => {
                            if (inactiveSelected.size === inactiveVols.length) {
                              setInactiveSelected(new Set())
                            } else {
                              setInactiveSelected(new Set(inactiveVols.map(v => v.id)))
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th style={thStyle}>{t('name_col')}</th>
                      <th style={thStyle}>{t('category_filter')}</th>
                      <th style={thStyle}>{t('last_active_col')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveVols.map((v, i) => (
                      <tr key={v.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f9f9f9', background: inactiveSelected.has(v.id) ? '#f0fdf4' : 'white' }}>
                        <td style={{ padding: '10px 20px' }}>
                          <input
                            type="checkbox"
                            checked={inactiveSelected.has(v.id)}
                            onChange={() => {
                              setInactiveSelected(prev => {
                                const next = new Set(prev)
                                next.has(v.id) ? next.delete(v.id) : next.add(v.id)
                                return next
                              })
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                          {v.firstName} {v.lastName}
                        </td>
                        <td style={{ padding: '10px 20px', fontSize: '13px', color: '#374151' }}>
                          {v.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </td>
                        <td style={{ padding: '10px 20px', fontSize: '13px', color: '#9ca3af' }}>
                          {v.lastActivityAt
                            ? new Date(v.lastActivityAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : t('never_label')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {inactiveSelected.size} of {inactiveVols.length} selected
                </span>
                <button
                  disabled={inactivePending || inactiveSelected.size === 0}
                  onClick={() => {
                    const ids = [...inactiveSelected]
                    setInactiveError(null)
                    setInactiveSuccessCount(null)
                    startInactiveTransition(async () => {
                      const result = await bulkMarkInactive(ids)
                      if (result.error) {
                        setInactiveError(result.error)
                      } else {
                        setInactiveSuccessCount(ids.length)
                        setInactiveSelected(new Set())
                      }
                    })
                  }}
                  style={{
                    padding: '7px 16px', borderRadius: '8px', border: 'none',
                    fontSize: '13px', fontWeight: 600, cursor: inactiveSelected.size === 0 ? 'default' : 'pointer',
                    background: inactiveSelected.size === 0 ? '#f3f4f6' : '#dc2626',
                    color: inactiveSelected.size === 0 ? '#9ca3af' : 'white',
                    opacity: inactivePending ? 0.6 : 1,
                  }}
                >
                  {inactivePending ? t('marking_inactive') : `${t('mark_inactive')} ${inactiveSelected.size || ''}`}
                </button>
                <button
                  onClick={() => downloadCSV(
                    inactiveVols.map(v => ({
                      Name: `${v.firstName} ${v.lastName}`,
                      Category: v.category,
                      'Last Active': v.lastActivityAt
                        ? new Date(v.lastActivityAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Never',
                    })),
                    `inactive-volunteers-${inactiveDays}d.csv`
                  )}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '8px',
                    background: NAVY, color: 'white', border: 'none',
                    cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  }}
                >
                  <Download style={{ width: '13px', height: '13px' }} />
                  {t('export_csv')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Credential Expiry ───────────────────────────────────── */}
      {activeTab === 'credentials' && (
        <div>
          {/* Window filter + export */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>{t('expiring_within')}</span>
            {([30, 60, 90] as const).map(w => (
              <button
                key={w}
                onClick={() => setCredWindow(w)}
                style={{
                  padding: '6px 14px', borderRadius: '7px', border: 'none',
                  cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                  background: credWindow === w ? NAVY : '#f3f4f6',
                  color: credWindow === w ? 'white' : '#6b7280',
                }}
              >
                {w} {t('days_suffix')}
              </button>
            ))}
            <button
              onClick={() => downloadCSV(
                filteredCreds.map(r => ({
                  Volunteer: r.name,
                  'Credential Type': r.credential_type,
                  'Expiration Date': r.expiration_date,
                  'Days Until Expiry': r.days_until_expiry,
                })),
                `credentials-expiry-${credWindow}d.csv`
              )}
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px',
                background: NAVY, color: 'white', border: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              }}
            >
              <Download style={{ width: '13px', height: '13px' }} />
              {t('export_csv')}
            </button>
          </div>

          {filteredCreds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px', background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <AlertTriangle style={{ width: '28px', height: '28px', color: '#d1fae5', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '14px', color: '#6b7280' }}>{t('no_creds_expiring')} {credWindow} {t('days_suffix')}</p>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={thStyle}>{t('volunteer')}</th>
                    <th style={thStyle}>{t('credential_type_col')}</th>
                    <th style={thStyle}>{t('expires_col')}</th>
                    <th style={thStyle}>{t('days_left_col')}</th>
                    <th style={thStyle}>{t('urgency_col')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCreds.map((r, i) => {
                    const urgent = r.days_until_expiry <= 7
                    const warn   = r.days_until_expiry <= 14
                    const color  = urgent ? '#dc2626' : warn ? '#ea580c' : '#ca8a04'
                    const bgCol  = urgent ? '#fef2f2' : warn ? '#fff7ed' : '#fefce8'
                    return (
                      <tr key={`${r.volunteer_id}_${r.credential_type}_${i}`} style={{ borderTop: i === 0 ? 'none' : '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{r.name}</td>
                        <td style={{ padding: '12px 20px', fontSize: '13px', color: '#374151' }}>{r.credential_type}</td>
                        <td style={{ padding: '12px 20px', fontSize: '13px', color: '#374151' }}>
                          {new Date(r.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '12px 20px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color, padding: '3px 8px', borderRadius: '6px', background: bgCol }}>
                            {r.days_until_expiry}d
                          </span>
                        </td>
                        <td style={{ padding: '12px 20px' }}>
                          <span style={{ fontSize: '12px', color, fontWeight: 500 }}>
                            {urgent ? '🔴 Critical' : warn ? '🟠 Warning' : '🟡 Notice'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
