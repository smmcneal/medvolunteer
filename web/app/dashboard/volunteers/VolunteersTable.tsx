'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'
import type { VolunteerRow } from './page'
import type { VolunteerCategory, VolunteerStatus, PipelinePhase } from '@/types/database'

const CATEGORY_LABELS: Record<VolunteerCategory, string> = {
  medical_professional: 'Medical',
  support_staff: 'Support',
  admin: 'Admin',
  trainee: 'Trainee',
  other: 'Other',
}

const CATEGORY_COLORS: Record<VolunteerCategory, { bg: string; text: string }> = {
  medical_professional: { bg: '#d1fae5', text: '#065f46' },
  support_staff:        { bg: '#dbeafe', text: '#1e40af' },
  admin:                { bg: '#ede9fe', text: '#5b21b6' },
  trainee:              { bg: '#fef3c7', text: '#92400e' },
  other:                { bg: '#f3f4f6', text: '#374151' },
}

const STATUS_LABELS: Record<VolunteerStatus, string> = {
  applicant: 'Applicant',
  prospect:  'Prospect',
  volunteer: 'Volunteer',
  inactive:  'Inactive',
}

const PHASE_LABELS: Record<PipelinePhase, string> = {
  intake:       'Intake',
  orientation:  'Orientation',
  review:       'Review',
  training:     'Training',
  active:       'Active',
  offboarding:  'Offboarding',
}

// Step index used to render the mini progress bar (0–5)
const PHASE_STEP: Record<PipelinePhase, number> = {
  intake: 0, orientation: 1, review: 2, training: 3, active: 4, offboarding: 5,
}

const STATUS_COLORS: Record<VolunteerStatus, { bg: string; text: string; dot: string }> = {
  applicant: { bg: '#f3f4f6', text: '#374151', dot: '#9ca3af' },
  prospect:  { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  volunteer: { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
  inactive:  { bg: '#f9fafb', text: '#6b7280', dot: '#d1d5db' },
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

type SortKey = 'name' | 'category' | 'status' | 'hours_this_month'
type SortDir = 'asc' | 'desc'

export default function VolunteersTable({
  volunteers,
  locations,
  initialFilters,
}: {
  volunteers: VolunteerRow[]
  locations: { id: string; name: string }[]
  initialFilters: { category?: string; status?: string; location?: string }
}) {
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState(initialFilters.category ?? '')
  const [status, setStatus]     = useState(initialFilters.status ?? '')
  const [location, setLocation] = useState(initialFilters.location ?? '')
  const [sort, setSort]         = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' })

  const filtered = useMemo(() => {
    let rows = [...volunteers]
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(v =>
        `${v.first_name} ${v.last_name}`.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q)
      )
    }
    if (category) rows = rows.filter(v => v.category === category)
    if (status)   rows = rows.filter(v => v.status === status)
    if (location) rows = rows.filter(v => v.locations.some(l => l.toLowerCase().includes(location.toLowerCase())))
    rows.sort((a, b) => {
      let cmp = 0
      if (sort.key === 'name')           cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      if (sort.key === 'category')       cmp = a.category.localeCompare(b.category)
      if (sort.key === 'status')         cmp = a.status.localeCompare(b.status)
      if (sort.key === 'hours_this_month') cmp = a.hours_this_month - b.hours_this_month
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [volunteers, search, category, status, location, sort])

  function toggleSort(key: SortKey) {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }
    )
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <ChevronUp style={{ width: '12px', height: '12px', color: '#d1d5db' }} />
    return sort.dir === 'asc'
      ? <ChevronUp   style={{ width: '12px', height: '12px', color: '#1B2A4A' }} />
      : <ChevronDown style={{ width: '12px', height: '12px', color: '#1B2A4A' }} />
  }

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: '8px', border: '1px solid #e5e7eb',
    fontSize: '13px', color: '#374151', background: 'white',
    cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
    paddingRight: '28px',
  }

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
      {/* Filter bar */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9ca3af' }} />
          <input type="text" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '7px 10px 7px 32px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', color: '#374151', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={category} onChange={e => setCategory(e.target.value)} style={selectStyle}>
            <option value="">All categories</option>
            {(Object.keys(CATEGORY_LABELS) as VolunteerCategory[]).map(k => (
              <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
            ))}
          </select>
          <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: '#6b7280', pointerEvents: 'none' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABELS) as VolunteerStatus[]).map(k => (
              <option key={k} value={k}>{STATUS_LABELS[k]}</option>
            ))}
          </select>
          <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: '#6b7280', pointerEvents: 'none' }} />
        </div>
        {locations.length > 0 && (
          <div style={{ position: 'relative' }}>
            <select value={location} onChange={e => setLocation(e.target.value)} style={selectStyle}>
              <option value="">All locations</option>
              {locations.map(l => (
                <option key={l.id} value={l.name}>{l.name}</option>
              ))}
            </select>
            <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: '#6b7280', pointerEvents: 'none' }} />
          </div>
        )}
        <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ padding: '64px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>No volunteers match the current filters.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <ThFirst onClick={() => toggleSort('name')} label="Volunteer" sortIcon={<SortIcon col="name" />} />
              <Th onClick={() => toggleSort('category')} label="Category" sortIcon={<SortIcon col="category" />} />
              <Th onClick={() => toggleSort('status')} label="Status" sortIcon={<SortIcon col="status" />} />
              <Th label="Pipeline" />
              <Th label="Tags" />
              <Th label="Flags" />
              <Th label="Location(s)" />
              <Th onClick={() => toggleSort('hours_this_month')} label="Hrs (month)" sortIcon={<SortIcon col="hours_this_month" />} />
              <th style={{ padding: '10px 16px', width: '40px' }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => {
              const catStyle  = CATEGORY_COLORS[v.category] ?? CATEGORY_COLORS.other
              const statStyle = STATUS_COLORS[v.status] ?? STATUS_COLORS.inactive
              return (
                <tr key={v.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f9f9f9' }}>
                  <td style={{ padding: '13px 16px 13px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: catStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: catStyle.text, flexShrink: 0 }}>
                        {initials(v.first_name, v.last_name)}
                      </div>
                      <div>
                        <Link href={`/dashboard/volunteers/${v.id}`} style={{ fontSize: '13px', fontWeight: 600, color: '#111827', textDecoration: 'none' }}>
                          {v.first_name} {v.last_name}
                        </Link>
                        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{v.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px', background: catStyle.bg, color: catStyle.text }}>
                      {CATEGORY_LABELS[v.category]}
                    </span>
                  </td>
                  <td style={{ padding: '13px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px', background: statStyle.bg, color: statStyle.text }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statStyle.dot, flexShrink: 0 }} />
                      {STATUS_LABELS[v.status]}
                    </span>
                  </td>
                  <td style={{ padding: '13px 12px' }}>
                    {(() => {
                      const step = PHASE_STEP[v.pipeline_phase]
                      const total = 6
                      return (
                        <div style={{ minWidth: 100 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                              {PHASE_LABELS[v.pipeline_phase]}
                            </span>
                            <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                              {step + 1}/{total}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {Array.from({ length: total }).map((_, i) => (
                              <div key={i} style={{
                                flex: 1, height: 3, borderRadius: 2,
                                background: i < step ? '#1B2A4A' : i === step ? '#00897B' : '#e5e7eb',
                              }} />
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </td>
                  <td style={{ padding: '13px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 160 }}>
                      {v.tags.length === 0
                        ? <span style={{ fontSize: '12px', color: '#d1d5db' }}>—</span>
                        : v.tags.map(tag => (
                          <span key={tag.id} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: tag.color + '22', color: tag.color, border: `1px solid ${tag.color}44`, whiteSpace: 'nowrap' }}>
                            {tag.name}
                          </span>
                        ))
                      }
                    </div>
                  </td>
                  <td style={{ padding: '13px 12px' }}>
                    {v.active_flags.length === 0 ? (
                      <span style={{ fontSize: '12px', color: '#d1d5db' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, maxWidth: 180 }}>
                        {v.active_flags.slice(0, 3).map(flag => {
                          const dotColor = flag.severity === 'critical' ? '#dc2626' : flag.severity === 'warning' ? '#f59e0b' : '#3b82f6'
                          return (
                            <span
                              key={flag.id}
                              title={flag.name}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: '11px', fontWeight: 600,
                                padding: '2px 7px', borderRadius: 99,
                                background: dotColor + '15', color: dotColor,
                                border: `1px solid ${dotColor}33`, whiteSpace: 'nowrap',
                              }}
                            >
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                              {flag.name}
                            </span>
                          )
                        })}
                        {v.active_flags.length > 3 && (
                          <span style={{ fontSize: '11px', color: '#9ca3af' }}>+{v.active_flags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '13px 12px' }}>
                    {v.locations.length === 0
                      ? <span style={{ fontSize: '12px', color: '#d1d5db' }}>—</span>
                      : v.locations.map(l => (
                          <span key={l} style={{ fontSize: '11px', background: '#f3f4f6', color: '#374151', padding: '2px 7px', borderRadius: '5px', marginRight: '4px' }}>{l}</span>
                        ))
                    }
                  </td>
                  <td style={{ padding: '13px 12px' }}>
                    {v.hours_this_month === 0 ? (
                      <span style={{ fontSize: '12px', color: '#d1d5db' }}>—</span>
                    ) : (
                      <span style={{
                        fontSize: '12px', fontWeight: 600,
                        color: v.hours_this_month >= 20 ? '#15803d' : v.hours_this_month >= 8 ? '#1d4ed8' : '#374151',
                      }}>
                        {v.hours_this_month.toFixed(1)} hrs
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                    <Link href={`/dashboard/volunteers/${v.id}`} style={{ color: '#d1d5db', textDecoration: 'none', fontSize: '16px' }}>→</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}

function Th({ label, onClick, sortIcon }: { label: string; onClick?: () => void; sortIcon?: React.ReactNode }) {
  return (
    <th onClick={onClick} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: onClick ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{label}{sortIcon}</span>
    </th>
  )
}

function ThFirst({ label, onClick, sortIcon }: { label: string; onClick?: () => void; sortIcon?: React.ReactNode }) {
  return (
    <th onClick={onClick} style={{ padding: '10px 12px 10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: onClick ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{label}{sortIcon}</span>
    </th>
  )
}
