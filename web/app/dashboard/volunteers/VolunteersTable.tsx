'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ChevronDown, ArrowRight, ChevronRight } from 'lucide-react'
import type { VolunteerRow } from './page'
import type { VolunteerStatus, PipelinePhase, Category } from '@/types/database'
import { useAdminT } from '@/lib/admin-lang'

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

const PHASE_STEP: Record<PipelinePhase, number> = {
  intake: 0, orientation: 1, review: 2, training: 3, active: 4, offboarding: 5,
}

const STATUS_COLORS: Record<VolunteerStatus, { bg: string; text: string; dot: string }> = {
  applicant: { bg: '#f3f4f6',  text: '#4a5168', dot: '#9ca3af' },
  prospect:  { bg: '#eff6ff',  text: '#1d4ed8', dot: '#3b82f6' },
  volunteer: { bg: '#ecfdf5',  text: '#065f46', dot: '#10b981' },
  inactive:  { bg: '#f9fafb',  text: '#9098b1', dot: '#d1d5db' },
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

type SortKey = 'name' | 'status' | 'hours_this_month' | 'pipeline_phase' | 'flag_severity' | 'tag_count' | 'location' | 'date_added'
type SortDir = 'asc' | 'desc'

const PALETTE = [
  { bg: '#eff6ff', text: '#1d4ed8', ring: '#bfdbfe' },
  { bg: '#f0fdf4', text: '#15803d', ring: '#bbf7d0' },
  { bg: '#fdf4ff', text: '#7e22ce', ring: '#e9d5ff' },
  { bg: '#fff7ed', text: '#c2410c', ring: '#fed7aa' },
  { bg: '#f0f9ff', text: '#0369a1', ring: '#bae6fd' },
  { bg: '#fefce8', text: '#a16207', ring: '#fef08a' },
  { bg: '#fff1f2', text: '#be123c', ring: '#fecdd3' },
  { bg: '#f8fafc', text: '#475569', ring: '#cbd5e1' },
]

const STATUS_ORDER: Record<VolunteerStatus, number> = {
  volunteer: 0, prospect: 1, applicant: 2, inactive: 3,
}

const FLAG_SEVERITY_NUM: Record<'critical' | 'warning' | 'info', number> = {
  critical: 0, warning: 1, info: 2,
}

function maxFlagSeverity(flags: VolunteerRow['active_flags']): number {
  if (flags.length === 0) return 3
  return Math.min(...flags.map(f => FLAG_SEVERITY_NUM[f.severity]))
}

type SortOption = { key: SortKey; dir: SortDir; label: string }

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: '8px',
  border: '1px solid var(--surface-border)',
  fontSize: '13px', color: 'var(--text-secondary)',
  background: 'white', cursor: 'pointer',
  appearance: 'none', WebkitAppearance: 'none',
  paddingRight: '28px',
  outline: 'none',
}

const SORT_OPTIONS: SortOption[] = [
  { key: 'name',             dir: 'asc',  label: 'Name A→Z' },
  { key: 'name',             dir: 'desc', label: 'Name Z→A' },
  { key: 'status',           dir: 'asc',  label: 'Status' },
  { key: 'pipeline_phase',   dir: 'asc',  label: 'Pipeline phase' },
  { key: 'flag_severity',    dir: 'asc',  label: 'Flag severity ↓' },
  { key: 'tag_count',        dir: 'desc', label: 'Tag count ↓' },
  { key: 'location',         dir: 'asc',  label: 'Location A→Z' },
  { key: 'hours_this_month', dir: 'desc', label: 'Hours this month ↓' },
  { key: 'date_added',       dir: 'desc', label: 'Date added ↓' },
]

export default function VolunteersTable({
  volunteers,
  locations,
  initialFilters,
  categories,
}: {
  volunteers: VolunteerRow[]
  locations: { id: string; name: string }[]
  initialFilters: { category?: string; status?: string; location?: string }
  categories: Category[]
}) {
  const t = useAdminT()
  function getCatStyle(slug: string) {
    const idx = categories.findIndex(c => c.slug === slug)
    if (idx === -1) return { bg: '#f3f4f6', text: '#6b7280', ring: '#e5e7eb' }
    return PALETTE[idx % PALETTE.length]
  }
  function getCatLabel(slug: string) {
    return categories.find(c => c.slug === slug)?.name ?? slug
  }
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
    if (category) rows = rows.filter(v => v.volunteer_categories.includes(category))
    if (status)   rows = rows.filter(v => v.status === status)
    if (location) rows = rows.filter(v => v.locations.some(l => l.toLowerCase().includes(location.toLowerCase())))
    rows.sort((a, b) => {
      let cmp = 0
      switch (sort.key) {
        case 'name':
          cmp = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
          break
        case 'status':
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
          break
        case 'hours_this_month':
          cmp = a.hours_this_month - b.hours_this_month
          break
        case 'pipeline_phase':
          cmp = (PHASE_STEP[a.pipeline_phase] ?? 0) - (PHASE_STEP[b.pipeline_phase] ?? 0)
          break
        case 'flag_severity':
          cmp = maxFlagSeverity(a.active_flags) - maxFlagSeverity(b.active_flags)
          break
        case 'tag_count':
          cmp = a.tags.length - b.tags.length
          break
        case 'location': {
          const aLoc = a.locations[0] ?? '\uffff'
          const bLoc = b.locations[0] ?? '\uffff'
          cmp = aLoc.localeCompare(bLoc)
          break
        }
        case 'date_added':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [volunteers, search, category, status, location, sort])

  const hasFilters = !!(search || category || status || location)

  return (
    <div style={{
      background: 'var(--surface-card)',
      borderRadius: '14px',
      border: '1px solid var(--surface-border)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
    }}>
      {/* ── Filter bar ── */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--surface-border-sub)',
        display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
        background: '#fafbfc',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search style={{
            position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
            width: '13px', height: '13px', color: 'var(--text-muted)',
          }} />
          <input
            type="text"
            placeholder={t('search_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px 7px 30px',
              border: '1px solid var(--surface-border)',
              borderRadius: '8px', fontSize: '13px',
              color: 'var(--text-secondary)', outline: 'none',
              boxSizing: 'border-box', background: 'white',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--teal)'}
            onBlur={e => e.target.style.borderColor = 'var(--surface-border)'}
          />
        </div>

        {/* Category */}
        <div style={{ position: 'relative' }}>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{
            ...selectStyle,
            borderColor: category ? 'var(--teal)' : 'var(--surface-border)',
            color: category ? 'var(--teal)' : 'var(--text-secondary)',
          }}>
            <option value="">{t('all_categories')}</option>
            {categories.map(c => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '11px', height: '11px', color: '#9098b1', pointerEvents: 'none' }} />
        </div>

        {/* Status */}
        <div style={{ position: 'relative' }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{
            ...selectStyle,
            borderColor: status ? 'var(--teal)' : 'var(--surface-border)',
            color: status ? 'var(--teal)' : 'var(--text-secondary)',
          }}>
            <option value="">{t('all_statuses')}</option>
            {(Object.keys(STATUS_LABELS) as VolunteerStatus[]).map(k => (
              <option key={k} value={k}>{STATUS_LABELS[k]}</option>
            ))}
          </select>
          <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '11px', height: '11px', color: '#9098b1', pointerEvents: 'none' }} />
        </div>

        {/* Location */}
        {locations.length > 0 && (
          <div style={{ position: 'relative' }}>
            <select value={location} onChange={e => setLocation(e.target.value)} style={{
              ...selectStyle,
              borderColor: location ? 'var(--teal)' : 'var(--surface-border)',
              color: location ? 'var(--teal)' : 'var(--text-secondary)',
            }}>
              <option value="">{t('all_locations')}</option>
              {locations.map(l => (
                <option key={l.id} value={l.name}>{l.name}</option>
              ))}
            </select>
            <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '11px', height: '11px', color: '#9098b1', pointerEvents: 'none' }} />
          </div>
        )}

        {/* Sort */}
        <SortDropdown
          sort={sort}
          onChange={(key, dir) => setSort({ key, dir })}
        />

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setCategory(''); setStatus(''); setLocation('') }}
            style={{
              padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--surface-border)',
              background: 'white', fontSize: '12px', color: 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
            }}
          >
            {t('clear')}
          </button>
        )}

        <span style={{ fontSize: '12px', color: 'var(--text-faint)', marginLeft: 'auto', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {filtered.length} {filtered.length !== 1 ? t('results') : t('result')}
        </span>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div style={{ padding: '72px 24px', textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Search style={{ width: '18px', height: '18px', color: '#d1d5db' }} />
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('no_volunteers')}</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('no_volunteers_sub')}</p>
        </div>
      )}

      {filtered.length > 0 && (<>

        {/* ── Desktop table (hidden on mobile) ── */}
        <div className="vol-table-view" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '940px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border-sub)' }}>
                <ThFirst label={t('col_name')} />
                <Th label={t('col_category')} />
                <Th label={t('col_status')} />
                <Th label={t('col_pipeline')} />
                <Th label={t('col_tags')} />
                <Th label={t('col_flags')} />
                <Th label={t('col_locations')} />
                <Th label={t('col_hours')} />
                <th style={{ padding: '10px 16px', width: '36px' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => {
                const catStyle  = getCatStyle(v.volunteer_categories[0] ?? v.category)
                const statStyle = STATUS_COLORS[v.status] ?? STATUS_COLORS.inactive
                const step      = PHASE_STEP[v.pipeline_phase]
                const total     = 6
                return (
                  <tr
                    key={v.id}
                    className="vol-row"
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--surface-border-sub)' }}
                  >
                    {/* Volunteer */}
                    <td style={{ padding: '12px 16px 12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%',
                          background: catStyle.bg, border: `2px solid ${catStyle.ring}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700, color: catStyle.text,
                          flexShrink: 0, letterSpacing: '0.02em',
                        }}>
                          {initials(v.first_name, v.last_name)}
                        </div>
                        <div>
                          <Link href={`/dashboard/volunteers/${v.id}`} className="vol-name-link" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', transition: 'color 0.1s', display: 'block' }}>
                            {v.first_name} {v.last_name}
                          </Link>
                          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>{v.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Category */}
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {v.volunteer_categories.map(cat => {
                          const cs = getCatStyle(cat)
                          return (
                            <span key={cat} style={{ fontSize: '12px', fontWeight: 500, padding: '3px 9px', borderRadius: '6px', background: cs.bg, color: cs.text, whiteSpace: 'nowrap' }}>
                              {getCatLabel(cat)}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    {/* Status */}
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500, padding: '3px 9px', borderRadius: '6px', background: statStyle.bg, color: statStyle.text }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statStyle.dot, flexShrink: 0 }} />
                        {STATUS_LABELS[v.status]}
                      </span>
                    </td>
                    {/* Pipeline */}
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ minWidth: 108 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>{PHASE_LABELS[v.pipeline_phase]}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{step + 1}/{total}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 2.5 }}>
                          {Array.from({ length: total }).map((_, idx) => (
                            <div key={idx} style={{ flex: 1, height: 4, borderRadius: 3, background: idx < step ? 'var(--navy)' : idx === step ? 'linear-gradient(90deg, #00BFA5, #00897B)' : 'var(--surface-border)' }} />
                          ))}
                        </div>
                      </div>
                    </td>
                    {/* Tags */}
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 156 }}>
                        {v.tags.length === 0 ? <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>—</span> : v.tags.map(tag => (
                          <span key={tag.id} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: tag.color + '1a', color: tag.color, border: `1px solid ${tag.color}33`, whiteSpace: 'nowrap' }}>{tag.name}</span>
                        ))}
                      </div>
                    </td>
                    {/* Flags */}
                    <td style={{ padding: '12px 12px' }}>
                      {v.active_flags.length === 0 ? <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>—</span> : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, maxWidth: 176 }}>
                          {v.active_flags.slice(0, 3).map(flag => {
                            const c = flag.severity === 'critical' ? '#dc2626' : flag.severity === 'warning' ? '#f59e0b' : '#3b82f6'
                            return (
                              <span key={flag.id} title={flag.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: c + '15', color: c, border: `1px solid ${c}33`, whiteSpace: 'nowrap' }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />{flag.name}
                              </span>
                            )
                          })}
                          {v.active_flags.length > 3 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+{v.active_flags.length - 3}</span>}
                        </div>
                      )}
                    </td>
                    {/* Locations */}
                    <td style={{ padding: '12px 12px' }}>
                      {v.locations.length === 0 ? <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>—</span> : v.locations.map(l => (
                        <span key={l} style={{ fontSize: '11px', background: 'var(--surface-bg)', color: 'var(--text-secondary)', padding: '2px 7px', borderRadius: '5px', marginRight: '4px', border: '1px solid var(--surface-border)' }}>{l}</span>
                      ))}
                    </td>
                    {/* Hours */}
                    <td style={{ padding: '12px 12px' }}>
                      {v.hours_this_month === 0 ? <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>—</span> : (
                        <span style={{ fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: v.hours_this_month >= 20 ? '#065f46' : v.hours_this_month >= 8 ? '#1d4ed8' : 'var(--text-secondary)' }}>
                          {v.hours_this_month.toFixed(1)}<span style={{ fontSize: '10px', fontWeight: 500, marginLeft: '2px', opacity: 0.7 }}>h</span>
                        </span>
                      )}
                    </td>
                    {/* Arrow */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Link href={`/dashboard/volunteers/${v.id}`} style={{ color: '#9098b1', textDecoration: 'none', display: 'inline-flex' }}>
                        <ArrowRight className="vol-arrow" style={{ width: '15px', height: '15px' }} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile card list (hidden on desktop) ── */}
        <div className="vol-card-view">
          {filtered.map((v, i) => {
            const catStyle  = getCatStyle(v.volunteer_categories[0] ?? v.category)
            const statStyle = STATUS_COLORS[v.status] ?? STATUS_COLORS.inactive
            const step      = PHASE_STEP[v.pipeline_phase]
            const total     = 6
            return (
              <Link
                key={v.id}
                href={`/dashboard/volunteers/${v.id}`}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div
                  className="vol-card-item"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--surface-border-sub)' }}
                >
                  {/* Row 1: avatar + name + email + status */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      background: catStyle.bg, border: `2px solid ${catStyle.ring}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700, color: catStyle.text, flexShrink: 0,
                    }}>
                      {initials(v.first_name, v.last_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.first_name} {v.last_name}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '6px', background: statStyle.bg, color: statStyle.text, flexShrink: 0 }}>
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: statStyle.dot, flexShrink: 0 }} />
                          {STATUS_LABELS[v.status]}
                        </span>
                      </div>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.email}
                      </p>
                    </div>
                    <ChevronRight style={{ width: '15px', height: '15px', color: 'var(--text-faint)', flexShrink: 0, marginTop: '2px' }} />
                  </div>

                  {/* Row 2: category badges + hours */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {v.volunteer_categories.map(cat => {
                      const cs = getCatStyle(cat)
                      return (
                        <span key={cat} style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '5px', background: cs.bg, color: cs.text, whiteSpace: 'nowrap' }}>
                          {getCatLabel(cat)}
                        </span>
                      )
                    })}
                    {v.active_flags.length > 0 && (
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '5px', background: v.active_flags[0].severity === 'critical' ? '#fef2f2' : v.active_flags[0].severity === 'warning' ? '#fffbeb' : '#eff6ff', color: v.active_flags[0].severity === 'critical' ? '#dc2626' : v.active_flags[0].severity === 'warning' ? '#f59e0b' : '#3b82f6' }}>
                        {v.active_flags.length} flag{v.active_flags.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {v.hours_this_month > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontWeight: 600, color: v.hours_this_month >= 20 ? '#065f46' : v.hours_this_month >= 8 ? '#1d4ed8' : 'var(--text-secondary)' }}>
                          {v.hours_this_month.toFixed(1)}h
                        </span>
                        {' '}{t('this_mo')}
                      </span>
                    )}
                  </div>

                  {/* Pipeline bar */}
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {PHASE_LABELS[v.pipeline_phase]}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                        {step + 1}/{total}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 2.5 }}>
                      {Array.from({ length: total }).map((_, idx) => (
                        <div key={idx} style={{ flex: 1, height: 4, borderRadius: 3, background: idx < step ? 'var(--navy)' : idx === step ? 'linear-gradient(90deg, #00BFA5, #00897B)' : 'var(--surface-border)' }} />
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  {v.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                      {v.tags.map(tag => (
                        <span key={tag.id} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: tag.color + '1a', color: tag.color, border: `1px solid ${tag.color}33` }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

      </>)}
    </div>
  )
}

function SortDropdown({
  sort,
  onChange,
}: {
  sort: { key: SortKey; dir: SortDir }
  onChange: (key: SortKey, dir: SortDir) => void
}) {
  const value = `${sort.key}__${sort.dir}`
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => {
          const [k, d] = e.target.value.split('__')
          onChange(k as SortKey, d as SortDir)
        }}
        style={selectStyle}
      >
        {SORT_OPTIONS.map(opt => (
          <option key={`${opt.key}__${opt.dir}`} value={`${opt.key}__${opt.dir}`}>
            Sort: {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '11px', height: '11px', color: '#9098b1', pointerEvents: 'none' }} />
    </div>
  )
}

function Th({
  label, onClick, sortIcon, active,
}: {
  label: string; onClick?: () => void; sortIcon?: React.ReactNode; active?: boolean
}) {
  return (
    <th
      onClick={onClick}
      className={onClick ? 'vol-th-sortable' : undefined}
      style={{
        padding: '10px 12px', textAlign: 'left',
        fontSize: '10.5px', fontWeight: 700,
        color: active ? 'var(--teal)' : 'var(--text-muted)',
        letterSpacing: '0.07em', textTransform: 'uppercase',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none', whiteSpace: 'nowrap',
        background: '#fafbfc',
        transition: 'color 0.1s',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        {label}{sortIcon}
      </span>
    </th>
  )
}

function ThFirst({
  label, onClick, sortIcon, active,
}: {
  label: string; onClick?: () => void; sortIcon?: React.ReactNode; active?: boolean
}) {
  return (
    <th
      onClick={onClick}
      className={onClick ? 'vol-th-sortable' : undefined}
      style={{
        padding: '10px 12px 10px 20px', textAlign: 'left',
        fontSize: '10.5px', fontWeight: 700,
        color: active ? 'var(--teal)' : 'var(--text-muted)',
        letterSpacing: '0.07em', textTransform: 'uppercase',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none', whiteSpace: 'nowrap',
        background: '#fafbfc',
        transition: 'color 0.1s',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        {label}{sortIcon}
      </span>
    </th>
  )
}
