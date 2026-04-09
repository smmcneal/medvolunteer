# Volunteers Table Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `VolunteersTable.tsx` to use a 4-column layout where categories, flags, tags, and locations collapse into a sub-row under each volunteer's name, with a color-coded left border for flagged rows and a unified Sort dropdown replacing column-header click-to-sort.

**Architecture:** All changes are confined to a single file (`VolunteersTable.tsx`). No new files, no backend changes — `page.tsx` already fetches all required data. The sort state shape is unchanged (`{ key, dir }`) but the type is extended and driven by a new `SortDropdown` component instead of column header clicks.

**Tech Stack:** Next.js 14, React 18, TypeScript, inline styles (existing pattern)

**Spec:** `docs/superpowers/specs/2026-04-08-volunteers-table-redesign.md`

---

## File Map

| File | Change |
|------|--------|
| `web/app/dashboard/volunteers/VolunteersTable.tsx` | All changes — sort types/logic, SortDropdown, desktop table columns/rows, mobile card view |

---

## Task 1: Sort types, helpers, and SortDropdown

**Files:**
- Modify: `web/app/dashboard/volunteers/VolunteersTable.tsx`

- [ ] **Step 1: Replace the `SortKey` type and add sort constants**

  Find the existing type declarations near the top of the component (after imports):
  ```ts
  type SortKey = 'name' | 'category' | 'status' | 'hours_this_month'
  type SortDir = 'asc' | 'desc'
  ```

  Replace with:
  ```ts
  type SortKey = 'name' | 'status' | 'hours_this_month' | 'pipeline_phase' | 'flag_severity' | 'tag_count' | 'location' | 'date_added'
  type SortDir = 'asc' | 'desc'
  ```

- [ ] **Step 2: Add sort helpers after the `PALETTE` constant**

  Insert this block immediately after the closing `]` of `PALETTE`:
  ```ts
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
  ```

- [ ] **Step 3: Rewrite the sort block inside `useMemo`**

  Find the `rows.sort(...)` block inside the `filtered` useMemo and replace it entirely:
  ```ts
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
  ```

- [ ] **Step 4: Remove `toggleSort` and `SortIcon`, replace with a direct setter**

  Delete the entire `toggleSort` function and the entire `SortIcon` function component.

  The sort state will be set directly by the new `SortDropdown`. No other code calls `toggleSort` once the desktop table headers are updated in Task 2.

- [ ] **Step 5: Add `SortDropdown` component at the bottom of the file (before `Th`)**

  Add this component after the closing `}` of `VolunteersTable` and before the `function Th(...)` definition:
  ```tsx
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
          style={{
            padding: '7px 10px', borderRadius: '8px',
            border: '1px solid var(--surface-border)',
            fontSize: '13px', color: 'var(--text-secondary)',
            background: 'white', cursor: 'pointer',
            appearance: 'none', WebkitAppearance: 'none',
            paddingRight: '28px',
            outline: 'none',
          }}
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
  ```

- [ ] **Step 6: Wire `SortDropdown` into the filter bar**

  Inside the filter bar `<div>` (the one with `padding: '14px 20px'` and `borderBottom`), find the "Clear filters" button and the results count `<span>`. Add `SortDropdown` between the Location select and the clear button:

  ```tsx
  {/* Sort */}
  <SortDropdown
    sort={sort}
    onChange={(key, dir) => setSort({ key, dir })}
  />
  ```

  Place it immediately before the `{hasFilters && (` block. It should always be visible (not conditional on hasFilters).

- [ ] **Step 7: Lint check**

  Run from `web/`:
  ```bash
  npm run lint
  ```
  Expected: no errors. If TypeScript complains about `'category'` being an invalid `SortKey`, confirm the old sort case for `'category'` was removed from the useMemo in Step 3.

- [ ] **Step 8: Commit**
  ```bash
  git add web/app/dashboard/volunteers/VolunteersTable.tsx
  git commit -m "feat: add sort dropdown with pipeline/flags/tags/location sort keys"
  ```

---

## Task 2: Desktop table — columns, sub-row, flag border

**Files:**
- Modify: `web/app/dashboard/volunteers/VolunteersTable.tsx`

- [ ] **Step 1: Simplify `Th` and `ThFirst` to label-only**

  The column headers no longer need onClick/active/sortIcon since sort is driven by the dropdown. Replace both functions at the bottom of the file:

  ```tsx
  function Th({ label }: { label: string }) {
    return (
      <th style={{
        padding: '10px 12px', textAlign: 'left',
        fontSize: '10.5px', fontWeight: 700,
        color: 'var(--text-muted)',
        letterSpacing: '0.07em', textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        background: '#fafbfc',
      }}>
        {label}
      </th>
    )
  }

  function ThFirst({ label }: { label: string }) {
    return (
      <th style={{
        padding: '10px 12px 10px 20px', textAlign: 'left',
        fontSize: '10.5px', fontWeight: 700,
        color: 'var(--text-muted)',
        letterSpacing: '0.07em', textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        background: '#fafbfc',
      }}>
        {label}
      </th>
    )
  }
  ```

- [ ] **Step 2: Rewrite the desktop `<thead>`**

  Find the `<thead>` inside `.vol-table-view` and replace it:
  ```tsx
  <thead>
    <tr style={{ borderBottom: '1px solid var(--surface-border-sub)' }}>
      <ThFirst label={t('col_name')} />
      <Th label={t('col_status')} />
      <Th label={t('col_pipeline')} />
      <Th label={t('col_hours')} />
      <th style={{ padding: '10px 16px', width: '36px', background: '#fafbfc' }} />
    </tr>
  </thead>
  ```

- [ ] **Step 3: Rewrite the desktop `<tbody>` rows**

  Replace the entire `{filtered.map((v, i) => { ... })}` block inside the desktop `<tbody>` with:

  ```tsx
  {filtered.map((v, i) => {
    const catStyle  = getCatStyle(v.volunteer_categories[0] ?? v.category)
    const statStyle = STATUS_COLORS[v.status] ?? STATUS_COLORS.inactive
    const step      = PHASE_STEP[v.pipeline_phase]
    const total     = 6

    // Left border color for flagged rows
    const borderColor = v.active_flags.some(f => f.severity === 'critical')
      ? '#dc2626'
      : v.active_flags.some(f => f.severity === 'warning')
        ? '#f59e0b'
        : undefined

    // Sub-row groups: categories → flags → tags → locations
    const subRowGroups: React.ReactNode[] = []

    if (v.volunteer_categories.length > 0) {
      subRowGroups.push(
        <span key="cats" style={{ display: 'contents' }}>
          {v.volunteer_categories.map(cat => {
            const cs = getCatStyle(cat)
            return (
              <span key={cat} style={{ fontSize: '12px', fontWeight: 500, padding: '3px 9px', borderRadius: '6px', background: cs.bg, color: cs.text, whiteSpace: 'nowrap' }}>
                {getCatLabel(cat)}
              </span>
            )
          })}
        </span>
      )
    }

    if (v.active_flags.length > 0) {
      subRowGroups.push(
        <span key="flags" style={{ display: 'contents' }}>
          {v.active_flags.map(flag => {
            const c = flag.severity === 'critical' ? '#dc2626' : flag.severity === 'warning' ? '#f59e0b' : '#3b82f6'
            return (
              <span key={flag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: c + '15', color: c, border: `1px solid ${c}33`, whiteSpace: 'nowrap' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />
                {flag.name}
              </span>
            )
          })}
        </span>
      )
    }

    if (v.tags.length > 0) {
      subRowGroups.push(
        <span key="tags" style={{ display: 'contents' }}>
          {v.tags.map(tag => (
            <span key={tag.id} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: tag.color + '1a', color: tag.color, border: `1px solid ${tag.color}33`, whiteSpace: 'nowrap' }}>
              {tag.name}
            </span>
          ))}
        </span>
      )
    }

    if (v.locations.length > 0) {
      subRowGroups.push(
        <span key="locs" style={{ fontSize: '11px', color: '#9098b1' }}>
          📍 {v.locations.join(' · ')}
        </span>
      )
    }

    return (
      <tr
        key={v.id}
        className="vol-row"
        style={{ borderTop: i === 0 ? 'none' : '1px solid var(--surface-border-sub)' }}
      >
        {/* Volunteer name + sub-row */}
        <td style={{
          padding: '12px 16px 12px 20px',
          ...(borderColor ? { boxShadow: `inset 3px 0 0 ${borderColor}` } : {}),
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
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
              {subRowGroups.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px', alignItems: 'center' }}>
                  {subRowGroups.flatMap((group, idx) =>
                    idx === 0
                      ? [group]
                      : [<span key={`sep-${idx}`} style={{ color: '#d1d5db', fontSize: '11px', lineHeight: 1 }}>·</span>, group]
                  )}
                </div>
              )}
            </div>
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
  ```

- [ ] **Step 4: Add `React` import for `React.ReactNode` type**

  The `subRowGroups: React.ReactNode[]` type reference requires `React` to be in scope. Check the top of the file — if the import line is:
  ```ts
  import { useState, useMemo } from 'react'
  ```
  Change it to:
  ```ts
  import React, { useState, useMemo } from 'react'
  ```
  If it already imports `React`, skip this step.

- [ ] **Step 5: Remove unused imports**

  Check the import line at the top. Remove any imports that are now unused:
  - `ChevronUp` — no longer used (was in SortIcon)
  - `Search` — still used in the empty state, keep it
  - `ArrowRight` — still used, keep it

  Update the lucide-react import line to remove `ChevronUp` if present.

- [ ] **Step 6: Lint check**

  Run from `web/`:
  ```bash
  npm run lint
  ```
  Expected: no errors. Common issues to fix:
  - `display: 'contents'` on a `<span>` — if TypeScript rejects this CSS value, cast as `React.CSSProperties` or change to `display: 'inline'` (items will still flex-wrap correctly inside the parent `display:flex` container).

- [ ] **Step 7: Commit**
  ```bash
  git add web/app/dashboard/volunteers/VolunteersTable.tsx
  git commit -m "feat: collapse table to 4 columns with sub-row and flag border accent"
  ```

---

## Task 3: Mobile card view + final build

**Files:**
- Modify: `web/app/dashboard/volunteers/VolunteersTable.tsx`

- [ ] **Step 1: Reorder the mobile card sub-row**

  Find the mobile card view inside `.vol-card-view` — specifically "Row 2" (the `<div>` with `marginTop: '10px'` containing category badges, flag count, and hours). Replace that entire Row 2 block with the new ordering (categories → flags → tags → locations, with hours right-aligned):

  ```tsx
  {/* Row 2: categories → flags → tags → locations + hours */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
    {v.volunteer_categories.map(cat => {
      const cs = getCatStyle(cat)
      return (
        <span key={cat} style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '5px', background: cs.bg, color: cs.text, whiteSpace: 'nowrap' }}>
          {getCatLabel(cat)}
        </span>
      )
    })}
    {v.active_flags.length > 0 && v.volunteer_categories.length > 0 && (
      <span style={{ color: '#d1d5db', fontSize: '11px' }}>·</span>
    )}
    {v.active_flags.slice(0, 2).map(flag => {
      const c = flag.severity === 'critical' ? '#dc2626' : flag.severity === 'warning' ? '#f59e0b' : '#3b82f6'
      return (
        <span key={flag.id} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: c + '15', color: c, border: `1px solid ${c}33`, whiteSpace: 'nowrap' }}>
          {flag.name}
        </span>
      )
    })}
    {v.active_flags.length > 2 && (
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+{v.active_flags.length - 2}</span>
    )}
    {v.tags.length > 0 && (v.volunteer_categories.length > 0 || v.active_flags.length > 0) && (
      <span style={{ color: '#d1d5db', fontSize: '11px' }}>·</span>
    )}
    {v.tags.map(tag => (
      <span key={tag.id} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: tag.color + '1a', color: tag.color, border: `1px solid ${tag.color}33`, whiteSpace: 'nowrap' }}>
        {tag.name}
      </span>
    ))}
    {v.locations.length > 0 && (v.volunteer_categories.length > 0 || v.active_flags.length > 0 || v.tags.length > 0) && (
      <span style={{ color: '#d1d5db', fontSize: '11px' }}>·</span>
    )}
    {v.locations.length > 0 && (
      <span style={{ fontSize: '11px', color: '#9098b1' }}>📍 {v.locations.join(' · ')}</span>
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
  ```

  The pipeline bar block (`<div style={{ marginTop: '10px' }}>` with phase label + bar) and the tags block that follows it can be deleted — tags are now in Row 2 above, and the pipeline bar is unchanged below Row 2.

  > Note: delete the old standalone tags block (`{v.tags.length > 0 && (...)`) that appears after the pipeline bar — those are now in Row 2.

- [ ] **Step 2: Final lint + build check**

  Run from `web/`:
  ```bash
  npm run lint && npm run build
  ```
  Expected: lint passes with no errors; build completes with no TypeScript errors. Fix any type errors before committing.

- [ ] **Step 3: Final commit**
  ```bash
  git add web/app/dashboard/volunteers/VolunteersTable.tsx
  git commit -m "feat: update mobile card view sub-row order to match desktop"
  ```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|-----------|
| 4 columns: Volunteer, Status, Pipeline, Hours | Task 2 Step 2+3 |
| Sub-row: categories → flags → tags → locations | Task 2 Step 3 |
| Group separators only between non-empty groups | Task 2 Step 3 (flatMap with sep) |
| Left border: red for critical, amber for warning, none for info-only | Task 2 Step 3 (borderColor logic) |
| Sort dropdown in filter bar | Task 1 Step 5+6 |
| Sort keys: name, status, pipeline, flag severity, tag count, location, hours, date added | Task 1 Step 2+3 |
| Name is only bidirectional sort key | Task 1 Step 3 (toggleSort removed, SortDropdown has two Name options) |
| Mobile card view sub-row reordered | Task 3 Step 1 |
| Filter bar unchanged (search, category, status) | Not touched in any task ✓ |
| No backend/page.tsx changes | Confirmed — all changes in VolunteersTable.tsx only |
