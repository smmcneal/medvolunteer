# MedVolunteer: Complete All Client Asks — Design Spec

**Date:** 2026-03-23
**Author:** Claude + Heather Gatlin (client)
**Source:** Dev - MedVolunteer CSV (19 feature asks)

---

## Status Summary

Of 19 feature asks from the client CSV, 16 were already fully implemented in the working
tree during a previous session. Two remained partial. This spec covers the two gaps plus
the deployment of all completed work.

| Feature | Status |
|---------|--------|
| Preferred Language (Spanish i18n) | ✅ Done |
| Recurring Shifts + Bulk Edit | ✅ Done |
| Jotform Integration | ✅ Done |
| Email Templates | ✅ Done |
| Reporting Filters (date, flags, tags) | ✅ Done |
| Unresolve Flags | ✅ Done |
| Volunteer Coordinators (per-category heads) | ✅ Done |
| Volunteer App: Reschedule a Shift | ✅ Done |
| Volunteer App: Record of Paperwork | ✅ Done |
| Multiple Categories per Volunteer | ✅ Done |
| Form Automation (checkbox → auto category/flag) | ✅ Done |
| Category Requirements (pre-shift rules) | ✅ Done |
| Report for Inactive Volunteers + Bulk Update | ✅ Done |
| Approving Hours (manual review toggle) | ✅ Done |
| Add Holidays to Calendar | ✅ Done |
| Calendar Views (Week + Day) | ✅ Done |
| Templates for Auto Messages + Cron | ✅ Done |
| **Internal Alert Trigger on Document Upload** | 🔶 Partial — gap below |
| **Add Category (dynamic, from Settings)** | 🔶 Partial — gap below |

---

## Gap 1 — Internal Alert Trigger on Document Upload

### What Exists
- `internal_alerts` table (id, triggered_by, assigned_to, volunteer_id, message, action_type, is_read)
- `document_automation_rules` table (id, trigger_document_type, alert_message, assigned_to)
- Settings Automation tab: admins create document rules (e.g. "when a file matching 'cv' is uploaded, alert this user with this message")
- `/dashboard/alerts` page: reads and marks alerts as read

### What's Missing
`uploadVolunteerDocument()` in `volunteers/[id]/actions.ts` successfully stores the file and
inserts into `volunteer_uploads`, but never reads `document_automation_rules` or creates any
`internal_alerts` row. The full alert pipeline is wired except for this one trigger point.

### Design
After a successful DB insert in `uploadVolunteerDocument()`:
1. Fetch all `document_automation_rules` (no org_id scoping needed — only one org)
2. For each rule: check if `file.name.toLowerCase()` includes `rule.trigger_document_type.toLowerCase()`
3. For each match: insert a row into `internal_alerts` with `triggered_by = uploader`, `assigned_to = rule.assigned_to`, `volunteer_id`, `message = rule.alert_message`, `action_type = 'document_added'`
4. Alert creation failures are non-fatal (log, don't block the upload response)

No new files. ~20 lines added to one existing server action.

---

## Gap 2 — Dynamic Categories (Add Category from Settings)

### Problem
`volunteer_category` is a Postgres enum with five fixed values
(`medical_professional`, `support_staff`, `admin`, `trainee`, `other`).
Admins cannot add new category types (e.g. "Community Engagement") at runtime.
The Settings Categories tab currently only manages metadata (descriptions, requirements,
coordinators) for those fixed five values — it has no "Add Category" button.

### Chosen Approach: Dynamic `categories` Table (Option A + C)
Migrate to a proper categories table. Archive instead of hard-delete. Seed existing enum values.

### Database Changes
1. New `categories` table:
   ```sql
   id          uuid PK DEFAULT gen_random_uuid()
   slug        text UNIQUE NOT NULL   -- machine key ('medical_professional', 'community_engagement')
   name        text NOT NULL          -- display name ('Medical Professional', 'Community Engagement')
   description text
   is_archived boolean DEFAULT false  -- soft delete; archived = hidden from assignment UI
   sort_order  int DEFAULT 0
   created_at  timestamptz DEFAULT now()
   ```
2. Seed with all five existing enum values (slug = existing enum value, name = human label)
3. `ALTER TABLE volunteers ALTER COLUMN volunteer_categories TYPE text[] USING volunteer_categories::text[]`
   — slug values are identical to enum values, so no data is lost
4. Drop and recreate the GIN index with the new type
5. Other migrations that reference `volunteer_category` type (category_requirements,
   category_coordinators) also need their columns changed to `text`

### TypeScript Changes
- `VolunteerCategory` type: `string` (was enum union)
- New `Category` interface: `{ id: string; slug: string; name: string; description: string | null; is_archived: boolean; sort_order: number }`
- All `CATEGORY_LABELS` / `CATEGORY_OPTIONS` / `CATEGORY_COLORS` constants removed — replaced by dynamic category lists passed as props

### UI Changes

**Settings → Categories tab:**
- Add "New Category" button → inline form: Name field, Description field, Save/Cancel
- `addCategory(name, description)` server action inserts into `categories` table, generates slug from name
- `archiveCategory(id)` / `restoreCategory(id)` — set `is_archived`
- Existing description/requirements/coordinator sub-features remain but now work against the dynamic table

**Volunteer InfoTab (multi-select):**
- Receives `categories: Category[]` as prop from page server component
- Renders toggle buttons for all non-archived categories
- Still writes `volunteer_categories text[]` (slugs) to `volunteers`

**VolunteersTable:**
- Receives `categories: Category[]` as prop
- Builds label/color lookup dynamically; assigns colors from a fixed 8-color palette by sort_order

**AddVolunteerModal:**
- Receives `categories: Category[]` as prop
- Dropdown uses dynamic list instead of hardcoded array

**MessagesView, ReportsView, filter dropdowns:**
- All receive `categories: Category[]` from their page's server component fetch

### Color Assignment
No color stored in DB. Assign from a fixed 8-color palette by `(sort_order % 8)`. This gives
consistent colors per category without storing hex codes, and new categories just get the next
color in the cycle.

---

## Part 3 — Commit and Deploy

All 16 completed features exist only in the working tree (never committed).
All 12 new migrations are untracked.

**Deployment steps:**
1. Commit all working tree changes in logical groups
2. `supabase db push` — applies all 12 migrations to the linked Supabase project
3. `git push origin main` — triggers Vercel auto-deploy

---

## Out of Scope

- Jotform OAuth (only API key stored; full OAuth flow is a separate project)
- Email delivery for internal alerts (alerts are in-app only)
- Category color picker (palette-based assignment is sufficient for v1)
