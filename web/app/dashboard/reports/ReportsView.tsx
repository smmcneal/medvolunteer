'use client'

import { useState, useMemo } from 'react'
import { Download, TrendingUp, Clock, ShieldCheck, AlertTriangle } from 'lucide-react'
import type { HoursRow, OnboardingRow, PipelinePhaseCount, VolunteerOnboardingRow, BgCheckRow, CredentialExpiryRow } from './page'

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

const CATEGORY_LABELS: Record<string, string> = {
  medical_professional: 'Medical',
  support_staff: 'Support',
  admin: 'Admin',
  trainee: 'Trainee',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  medical_professional: { bg: '#d1fae5', text: '#065f46' },
  support_staff:        { bg: '#dbeafe', text: '#1e40af' },
  admin:                { bg: '#ede9fe', text: '#5b21b6' },
  trainee:              { bg: '#fef3c7', text: '#92400e' },
  other:                { bg: '#f3f4f6', text: '#374151' },
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
] as const

type Tab = typeof TABS[number]['key']

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportsView({
  hoursRows,
  onboardingRows,
  pipelineStats,
  volunteerOnboardingRows,
  bgRows,
  credRows,
}: {
  hoursRows: HoursRow[]
  onboardingRows: OnboardingRow[]
  pipelineStats: PipelinePhaseCount[]
  volunteerOnboardingRows: VolunteerOnboardingRow[]
  bgRows: BgCheckRow[]
  credRows: CredentialExpiryRow[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('hours')

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

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '24px',
        borderBottom: '1px solid #f0f0f0', paddingBottom: '0',
      }}>
        {TABS.map(({ key, label, icon: Icon }) => (
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
            {label}
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
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button
              onClick={() => downloadCSV(
                filteredHours.map(r => ({
                  Name: r.name,
                  Category: CATEGORY_LABELS[r.category] ?? r.category,
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
              Export CSV
            </button>
          </div>

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
            {filteredHours.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <Clock style={{ width: '28px', height: '28px', color: '#e5e7eb', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>No hours data found</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={thStyle}>Volunteer</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Sessions</th>
                    <th style={thStyle}>Total Hours</th>
                    <th style={thStyle}>Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHours.map((r, i) => {
                    const catStyle = CATEGORY_COLORS[r.category] ?? CATEGORY_COLORS.other
                    const maxMins  = hoursRows[0]?.total_minutes ?? 1
                    const pct      = Math.round((r.total_minutes / maxMins) * 100)
                    return (
                      <tr key={r.volunteer_id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{r.name}</td>
                        <td style={{ padding: '12px 20px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px', background: catStyle.bg, color: catStyle.text }}>
                            {CATEGORY_LABELS[r.category] ?? r.category}
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
                  const catStyle = row.category ? (CATEGORY_COLORS[row.category] ?? CATEGORY_COLORS.other) : { bg: '#f3f4f6', text: '#374151' }
                  return (
                    <div key={row.workflow_id} style={{
                      background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', padding: '18px 22px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{row.workflow_name}</h3>
                          <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '5px', background: catStyle.bg, color: catStyle.text }}>
                            {row.category ? CATEGORY_LABELS[row.category] ?? row.category : 'All categories'}
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
                  <option value="">All phases</option>
                  {Object.entries(PIPELINE_PHASE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button
                  onClick={() => downloadCSV(
                    filteredOnboardingVols.map(r => ({
                      Name: r.name,
                      Category: CATEGORY_LABELS[r.category] ?? r.category,
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
                  Export CSV
                </button>
              </div>
            </div>

            {filteredOnboardingVols.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
                <TrendingUp style={{ width: '28px', height: '28px', color: '#e5e7eb', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>No volunteers match the current filter</p>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={thStyle}>Volunteer</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Phase</th>
                      <th style={thStyle}>Workflow</th>
                      <th style={thStyle}>Stages</th>
                      <th style={thStyle}>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOnboardingVols.map((r, i) => {
                      const catStyle   = CATEGORY_COLORS[r.category] ?? CATEGORY_COLORS.other
                      const phaseStyle = PIPELINE_PHASE_COLORS[r.pipeline_phase] ?? PIPELINE_PHASE_COLORS.intake
                      const pct        = r.completion_pct
                      const barColor   = pct === 100 ? '#22c55e' : pct >= 60 ? NAVY : '#f59e0b'
                      return (
                        <tr key={r.volunteer_id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f9f9f9' }}>
                          <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{r.name}</td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px', background: catStyle.bg, color: catStyle.text }}>
                              {CATEGORY_LABELS[r.category] ?? r.category}
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
                              <span style={{ fontSize: '12px', color: '#d1d5db' }}>No workflow</span>
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
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>No background check data yet</p>
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

      {/* ── Credential Expiry ───────────────────────────────────── */}
      {activeTab === 'credentials' && (
        <div>
          {/* Window filter + export */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Expiring within:</span>
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
                {w} days
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
              Export CSV
            </button>
          </div>

          {filteredCreds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px', background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <AlertTriangle style={{ width: '28px', height: '28px', color: '#d1fae5', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '14px', color: '#6b7280' }}>No credentials expiring in the next {credWindow} days</p>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={thStyle}>Volunteer</th>
                    <th style={thStyle}>Credential Type</th>
                    <th style={thStyle}>Expires</th>
                    <th style={thStyle}>Days Left</th>
                    <th style={thStyle}>Urgency</th>
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
