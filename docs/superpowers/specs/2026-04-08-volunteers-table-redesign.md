# Volunteers Table Redesign

**Date:** 2026-04-08
**File:** `web/app/dashboard/volunteers/VolunteersTable.tsx`

---

## Problem

The current table has 9 columns. Tags, Flags, and Locations are empty (`—`) for most volunteers, creating a visually sparse, wide table. The Category column renders 2–3 long text badges per cell, blowing out its width. There is also no way to sort by Pipeline phase, flag severity, tag count, or location.

---

## Design Decisions

### 1. Column structure — 4 columns

Remove Category, Tags, Flags, and Locations as dedicated columns. Replace with:

| Column | Notes |
|--------|-------|
| **Volunteer** | Name, email, and sub-row (see below) |
| **Status** | Existing badge — unchanged |
| **Pipeline** | Existing phase label + progress bar — now sortable |
| **Hours** | Existing hours value — unchanged |
| *(arrow)* | Navigation arrow — unchanged |

### 2. Sub-row under the volunteer name

Each row renders a secondary line below the name/email with contextual data. Only non-empty groups are shown. Groups are separated by a `·` dot.

**Order:** Categories → Flags → Tags → Locations

- **Categories** — colored badge chips, same palette as today
- **Flags** — pill badges with severity color (red = critical, amber = warning, blue = info). Each flag shows its name. Flags sort before tags so urgent items appear first.
- **Tags** — pill badges, same color-coded style as today
- **Locations** — plain text prefixed with 📍, locations joined by ` · `

If a group is empty it is omitted entirely, including its separator dot.

### 3. Flag row accent — left border

Rows with one or more active flags get a 3px colored left border (implemented as `box-shadow: inset 3px 0 0 <color>` on the first `td`):

- Critical flag present → `#dc2626` (red)
- Warning flag present, no critical → `#f59e0b` (amber)
- Info flags only → no border (info flags are low-urgency enough that the pill in the sub-row is sufficient)
- Highest severity wins when multiple flags of different severities exist

### 4. Sort by dropdown

Replace column-header click-to-sort with a single **"Sort by"** dropdown control in the filter bar. This is necessary because Tags, Flags, and Locations are no longer column headers.

**Dropdown label format:** `Sort [active key] [direction arrow]` (e.g. "Sort  Flag severity ↓")

**Available sort keys:**

| Key | Sort logic |
|-----|-----------|
| Name A→Z / Z→A | `last_name, first_name` alphabetical |
| Status | Fixed order: volunteer → prospect → applicant → inactive |
| Pipeline phase | Fixed order: intake → orientation → review → training → active → offboarding |
| Flag severity ↓ | critical → warning → info → none |
| Tag count ↓ | Most tags first |
| Location A→Z | First location name alphabetically; no-location rows last |
| Hours this month ↓ | Highest hours first |
| Date added ↓ | Most recently created first |

Default sort: **Name A→Z**.

Sort state remains `{ key: SortKey; dir: SortDir }`. When a new key is selected, `dir` resets to the fixed useful direction for that key (e.g. `'asc'` for Name, `'desc'` for Hours). Name is the only key where selecting it again toggles the direction; all other keys are single-direction.

### 5. Filter bar — unchanged

The search input, Category dropdown, and Status dropdown remain exactly as they are. No new filter controls are added.

---

## What Changes in the Code

### `VolunteersTable.tsx`

1. **Update** `SortKey` type: remove `'category'`; add `'pipeline_phase' | 'flag_severity' | 'tag_count' | 'location' | 'date_added'` (keep existing `'name' | 'status' | 'hours_this_month'`).
2. **Remove** `<Th>` / `<ThFirst>` column headers for Category, Tags, Flags, Locations.
3. Pipeline `<Th>` already exists and is sortable — no change needed there.
4. **Update** `toggleSort` to reset `dir` to the fixed useful direction when switching to a non-Name key.
5. **Add** `SortDropdown` component in the filter bar (a `<select>` styled to match existing filter chips).
6. **Rewrite** the `filtered` `useMemo` sort block to cover all new sort keys.
7. **Rewrite** the desktop table row `<td>` cells: remove Category/Tags/Flags/Locations cells; add sub-row to the Volunteer cell.
8. **Add** left border logic: compute `flagBorderColor` per row from `active_flags` severity.
9. **Update** mobile card view to match the same sub-row ordering (categories → flags → tags → locations).

### No other files change

`page.tsx` already fetches `active_flags`, `tags`, `locations`, and `pipeline_phase` — all data is available. No backend changes needed.

---

## Behaviour Details

- Sub-row separator dots are only rendered between non-empty groups (no leading/trailing dots, no double dots).
- If a volunteer has no categories, no flags, no tags, and no locations, the sub-row is not rendered at all (name + email only).
- Pipeline sort uses the existing `PHASE_STEP` map.
- Flag severity sort maps: critical = 0, warning = 1, info = 2, none = 3 (ascending = most urgent first).
- The `SortDropdown` renders a native `<select>` (consistent with the existing Category/Status filter selects), styled to show `Sort [label]` as its display value.
