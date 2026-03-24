# Complete All Client Asks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two remaining partial features (internal alert trigger on doc upload, dynamic categories), commit all 16 already-implemented features, push migrations, and deploy to Vercel.

**Architecture:** Gap 1 is a ~20-line addition to one existing server action. Gap 2 is a DB migration + TypeScript refactor replacing a hardcoded enum with a dynamic `categories` table. All changes are committed and deployed at the end.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), TypeScript strict, Tailwind CSS, Vercel

---

## File Map

### Gap 1 — Alert Trigger
- **Modify:** `web/app/dashboard/volunteers/[id]/actions.ts` — add alert creation logic after successful upload in `uploadVolunteerDocument()`

### Gap 2 — Dynamic Categories

**New migration:**
- Create: `supabase/migrations/20260323_dynamic_categories.sql`

**Type changes:**
- Modify: `web/types/database.ts` — `VolunteerCategory → string`, add `Category` interface

**Settings:**
- Modify: `web/app/dashboard/settings/SettingsView.tsx` — add Category add/archive UI
- Modify: `web/app/dashboard/settings/actions.ts` — add `addCategory`, `archiveCategory`, `restoreCategory`
- Modify: `web/app/dashboard/settings/page.tsx` — fetch categories from DB and pass as prop

**Volunteer list + add:**
- Modify: `web/app/dashboard/volunteers/page.tsx` — fetch categories, pass to table + modal
- Modify: `web/app/dashboard/volunteers/VolunteersTable.tsx` — replace hardcoded constants with prop
- Modify: `web/app/dashboard/volunteers/AddVolunteerModal.tsx` — replace hardcoded array with prop

**Volunteer detail:**
- Modify: `web/app/dashboard/volunteers/[id]/page.tsx` — fetch categories, pass to InfoTab
- Modify: `web/app/dashboard/volunteers/[id]/InfoTab.tsx` — replace hardcoded CATEGORY_OPTIONS with prop
- Modify: `web/app/dashboard/volunteers/[id]/actions.ts` — change `VolunteerCategory` types to `string`

**Messages + Reports:**
- Modify: `web/app/dashboard/messages/page.tsx` — fetch categories, pass to MessagesView
- Modify: `web/app/dashboard/messages/MessagesView.tsx` — replace `CATEGORY_LABELS` with dynamic prop
- Modify: `web/app/dashboard/reports/page.tsx` — fetch categories, pass to ReportsView
- Modify: `web/app/dashboard/reports/ReportsView.tsx` — replace `CATEGORY_LABELS` with dynamic prop

---

## Task 1 — Alert Trigger on Document Upload

**Files:**
- Modify: `web/app/dashboard/volunteers/[id]/actions.ts` (around line 262, after the upload insert)

- [ ] **Step 1: Open `actions.ts` and locate `uploadVolunteerDocument`**

  Find the block that ends with `revalidatePath(...)` and `return {}` (around line 264).
  Add the following alert-firing block immediately before the `revalidatePath` call:

  ```typescript
  // ─── Fire document automation alerts ──────────────────────────────────────
  try {
    const { data: rules } = await admin
      .from('document_automation_rules')
      .select('trigger_document_type, alert_message, assigned_to')

    if (rules?.length) {
      const lowerName = file.name.toLowerCase()
      const matches = rules.filter(r =>
        r.trigger_document_type &&
        lowerName.includes(r.trigger_document_type.toLowerCase())
      )
      if (matches.length) {
        const supabaseForAlert = await createClient()
        const { data: { user: uploader } } = await supabaseForAlert.auth.getUser()
        await admin.from('internal_alerts').insert(
          matches.map(r => ({
            triggered_by:  uploader?.id ?? null,
            assigned_to:   r.assigned_to ?? null,
            volunteer_id:  volunteerId,
            message:       r.alert_message,
            action_type:   'document_added',
          }))
        )
      }
    }
  } catch {
    // Alert creation is non-fatal — never block the upload response
  }
  ```

  The column name `trigger_document_type` matches the schema in
  `supabase/migrations/20260323_internal_alerts.sql` — verify if unsure before continuing.

  > `createClient` is already imported at the top of `actions.ts` (line 4) — no new import needed.
  > The second `await createClient()` call in the alert block reuses the same import.

- [ ] **Step 2: Build to verify no TypeScript errors**

  ```bash
  cd web && npm run build 2>&1 | tail -25
  ```
  Expected: build succeeds (or only pre-existing errors unrelated to this change).

- [ ] **Step 4: Commit**

  ```bash
  git add web/app/dashboard/volunteers/[id]/actions.ts
  git commit -m "feat: fire internal alerts when a volunteer document is uploaded"
  ```

---

## Task 2 — Dynamic Categories Migration

**Files:**
- Create: `supabase/migrations/20260323_dynamic_categories.sql`

- [ ] **Step 1: Create the migration file**

  ```sql
  -- =============================================================================
  -- Dynamic Categories: replace volunteer_category enum array with text[] + table
  -- =============================================================================

  -- 1. Create the categories table
  CREATE TABLE IF NOT EXISTS categories (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT    UNIQUE NOT NULL,
    name        TEXT    NOT NULL,
    description TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    sort_order  INT     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "admin_manage_categories" ON categories FOR ALL USING (true);

  -- 2. Seed with existing enum values (slug = enum value, name = display label)
  INSERT INTO categories (slug, name, sort_order) VALUES
    ('medical_professional', 'Medical Professional', 0),
    ('support_staff',        'Support Staff',        1),
    ('admin',                'Admin / Coordinator',  2),
    ('trainee',              'Trainee',              3),
    ('other',                'Other',                4)
  ON CONFLICT (slug) DO NOTHING;

  -- 3. Drop the old GIN index on volunteer_categories (it's typed to volunteer_category[])
  DROP INDEX IF EXISTS idx_volunteers_categories;

  -- 4. Change volunteer_categories column from volunteer_category[] to text[]
  --    The slug values are identical to the enum values, so no data transform needed.
  ALTER TABLE volunteers
    ALTER COLUMN volunteer_categories TYPE text[]
    USING volunteer_categories::text[];

  -- 5. Recreate GIN index for the new text[] column
  CREATE INDEX idx_volunteers_categories ON volunteers USING GIN (volunteer_categories);

  -- 6. Fix category_requirements table (uses volunteer_category type)
  ALTER TABLE category_requirements
    ALTER COLUMN category TYPE text
    USING category::text;

  -- 7. Fix org_category_coordinators table (uses volunteer_category type)
  ALTER TABLE org_category_coordinators
    ALTER COLUMN category TYPE text
    USING category::text;
  ```

- [ ] **Step 2: Validate migration SQL syntax before pushing**

  The migration uses this cast for the `volunteer_categories` column type change:
  ```sql
  USING volunteer_categories::text[]
  ```
  If Postgres rejects this (error: `cannot cast type volunteer_category[] to text[]`), open
  the migration file and replace that USING clause with the explicit unnest form:
  ```sql
  USING ARRAY(SELECT unnest(volunteer_categories)::text)
  ```
  Both forms are functionally identical. The second is more portable.

  **If you have a local Supabase running**, test now:
  ```bash
  supabase db push --local
  ```
  **If you do not have a local instance:** Read through the migration SQL carefully for syntax
  errors before continuing to Task 10. A broken migration pushed to remote will require a
  manual fix in the Supabase SQL editor, which is disruptive. The migration in this plan has
  been reviewed and the explicit-cast fallback is included in Task 10 as a contingency.

- [ ] **Step 3: Commit migration**

  ```bash
  git add supabase/migrations/20260323_dynamic_categories.sql
  git commit -m "feat: add dynamic categories table, migrate volunteer_categories to text[]"
  ```

---

## Task 3 — Update TypeScript Types

**Files:**
- Modify: `web/types/database.ts`

- [ ] **Step 1: Add `Category` interface and update `VolunteerCategory`**

  Find the `VolunteerCategory` type (currently a union of enum strings). Replace with:
  ```typescript
  // Dynamic — values now come from the `categories` table
  export type VolunteerCategory = string

  export interface Category {
    id: string
    slug: string
    name: string
    description: string | null
    is_archived: boolean
    sort_order: number
    created_at: string
  }
  ```

  Also update the `Volunteer` type's `volunteer_categories` field — it should already be
  `VolunteerCategory[]` (now `string[]`), so no change needed there if the type alias is updated.

- [ ] **Step 2: Quick build check**

  ```bash
  cd web && npx tsc --noEmit 2>&1
  ```
  Do NOT truncate this output. Review all errors — they will tell you exactly which files
  still reference `VolunteerCategory` as an enum union and need the prop-based update.
  Use this output as a checklist for Tasks 4–8.

- [ ] **Step 3: Commit**

  ```bash
  git add web/types/database.ts
  git commit -m "types: VolunteerCategory → string, add Category interface"
  ```

---

## Task 4 — Settings: Category Management Actions + Page

**Files:**
- Modify: `web/app/dashboard/settings/actions.ts`
- Modify: `web/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Add category CRUD actions to `settings/actions.ts`**

  Add at the end of the file:

  ```typescript
  // ─── Dynamic categories ───────────────────────────────────────────────────

  function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }

  export async function addCategory(
    name: string,
    description: string,
  ): Promise<{ error?: string }> {
    if (!name.trim()) return { error: 'Category name is required.' }
    const admin = createAdminClient()
    const slug = slugify(name.trim())
    const { error } = await admin.from('categories').insert({
      slug,
      name: name.trim(),
      description: description.trim() || null,
    })
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return {}
  }

  export async function updateCategoryDescription(
    id: string,
    description: string,
  ): Promise<{ error?: string }> {
    const admin = createAdminClient()
    const { error } = await admin.from('categories').update({ description: description.trim() || null }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return {}
  }

  export async function archiveCategory(id: string): Promise<{ error?: string }> {
    const admin = createAdminClient()
    const { error } = await admin.from('categories').update({ is_archived: true }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return {}
  }

  export async function restoreCategory(id: string): Promise<{ error?: string }> {
    const admin = createAdminClient()
    const { error } = await admin.from('categories').update({ is_archived: false }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return {}
  }
  ```

- [ ] **Step 2: Fetch categories in `settings/page.tsx`**

  In the page's data-fetching block, add:
  ```typescript
  const { data: categoriesData } = await admin.from('categories').select('*').order('sort_order')
  const categories = (categoriesData ?? []) as Category[]
  ```
  Import `Category` from `@/types/database` at the top.
  Pass `categories` as a prop to `<SettingsView categories={categories} ... />`.

  > **Supabase client syntax reminder:** All filtering uses chained methods — `.eq('col', val)`,
  > `.neq()`, `.gt()`, etc. Never use `.where(...)` — that is not a valid method on the Supabase client.

- [ ] **Step 3: Commit**

  ```bash
  git add web/app/dashboard/settings/actions.ts web/app/dashboard/settings/page.tsx
  git commit -m "feat: add/archive/restore category actions, fetch categories in settings page"
  ```

---

## Task 5 — Settings UI: Categories Tab Add/Archive

**Files:**
- Modify: `web/app/dashboard/settings/SettingsView.tsx`

- [ ] **Step 1: Add `categories` prop to SettingsView**

  At the top of the component, add `categories: Category[]` to the props type.
  Import `Category` from `@/types/database` and the new actions:
  ```typescript
  import { addCategory, archiveCategory, restoreCategory, updateCategoryDescription } from './actions'
  ```

- [ ] **Step 2: In the Categories tab, add the "New Category" inline form**

  Find the section that lists existing categories. At the top of that section, add:

  ```tsx
  {/* Add new category */}
  {showAddCategory ? (
    <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'flex-end' }}>
      <div style={{ flex: 1 }}>
        <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Name</label>
        <input
          value={newCatName} onChange={e => setNewCatName(e.target.value)}
          placeholder="e.g. Community Engagement"
          style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
        />
      </div>
      <div style={{ flex: 2 }}>
        <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Description (optional)</label>
        <input
          value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)}
          placeholder="What does this role involve?"
          style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
        />
      </div>
      <button type="submit" disabled={catPending} style={{ padding: '8px 16px', background: '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
        Save
      </button>
      <button type="button" onClick={() => setShowAddCategory(false)} style={{ padding: '8px 12px', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
        Cancel
      </button>
    </form>
  ) : (
    <button onClick={() => setShowAddCategory(true)} style={{ marginBottom: '16px', padding: '8px 14px', background: '#f0f4ff', color: '#1B2A4A', border: '1.5px solid #c7d2fe', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
      + New Category
    </button>
  )}
  ```

  Add state variables: `showAddCategory`, `newCatName`, `newCatDesc`, `catPending`.

  Add handler:
  ```typescript
  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    setCatPending(true)
    const result = await addCategory(newCatName, newCatDesc)
    setCatPending(false)
    if (result.error) { alert(result.error); return }
    setShowAddCategory(false)
    setNewCatName('')
    setNewCatDesc('')
  }
  ```

- [ ] **Step 3: Add Archive/Restore buttons to each category row**

  For each category in the list, add at the end of its row:
  ```tsx
  {cat.is_archived ? (
    <button onClick={() => startTransition(() => { void restoreCategory(cat.id) })}
      style={{ fontSize: '12px', color: '#059669', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
      Restore
    </button>
  ) : (
    <button onClick={() => { if (confirm(`Archive "${cat.name}"? Existing volunteers keep this category but it won't appear in the assignment list.`)) startTransition(() => { void archiveCategory(cat.id) }) }}
      style={{ fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
      Archive
    </button>
  )}
  ```

  Show archived categories in a collapsed "Archived" section at the bottom.

- [ ] **Step 4: Build check**

  ```bash
  cd web && npm run build 2>&1 | grep -E "error|Error" | head -20
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add web/app/dashboard/settings/SettingsView.tsx
  git commit -m "feat: categories tab — add new category, archive/restore"
  ```

---

## Task 6 — Volunteer List + Add Modal: Dynamic Categories

**Files:**
- Modify: `web/app/dashboard/volunteers/page.tsx`
- Modify: `web/app/dashboard/volunteers/VolunteersTable.tsx`
- Modify: `web/app/dashboard/volunteers/AddVolunteerModal.tsx`

- [ ] **Step 1: Fetch categories in `volunteers/page.tsx`**

  Add to the data-fetching block:
  ```typescript
  const { data: categoriesData } = await admin
    .from('categories')
    .select('*')
    .eq('is_archived', false)
    .order('sort_order')
  const categories = (categoriesData ?? []) as Category[]
  ```
  Pass `categories` to both `<VolunteersTable>` and `<AddVolunteerModal>`.

- [ ] **Step 2: Update `VolunteersTable.tsx`**

  First, confirm the constants exist — search the file for `CATEGORY_LABELS` and `CATEGORY_COLORS`
  before making any edits:
  ```bash
  grep -n "CATEGORY_LABELS\|CATEGORY_COLORS\|CATEGORY_OPTIONS" web/app/dashboard/volunteers/VolunteersTable.tsx
  ```
  If either constant is named differently in the actual file, use whatever name appears in the grep output.

  - Remove the hardcoded `CATEGORY_LABELS` and `CATEGORY_COLORS` constants at the top
  - Add `categories: Category[]` to component props
  - Add a helper inside the component:
    ```typescript
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
    function getCatStyle(slug: string) {
      const idx = categories.findIndex(c => c.slug === slug)
      return PALETTE[Math.max(idx, 0) % PALETTE.length]
    }
    function getCatLabel(slug: string) {
      return categories.find(c => c.slug === slug)?.name ?? slug
    }
    ```
  - Replace all `CATEGORY_LABELS[cat]` with `getCatLabel(cat)`
  - Replace all `CATEGORY_COLORS[cat]` with `getCatStyle(cat)`
  - Replace the category filter `<select>` options loop: `categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)`

- [ ] **Step 3: Update `AddVolunteerModal.tsx`**

  - Remove hardcoded `CATEGORIES` array constant
  - Add `categories: Category[]` to props
  - Change the category `<select>` options to use `categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)`
  - Set initial state to `categories[0]?.slug ?? ''`

- [ ] **Step 4: Build check**

  ```bash
  cd web && npm run build 2>&1 | grep -E "^.*error" | head -20
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add web/app/dashboard/volunteers/page.tsx \
          web/app/dashboard/volunteers/VolunteersTable.tsx \
          web/app/dashboard/volunteers/AddVolunteerModal.tsx
  git commit -m "feat: volunteer list uses dynamic categories from DB"
  ```

---

## Task 7 — Volunteer Detail: InfoTab Dynamic Categories

**Files:**
- Modify: `web/app/dashboard/volunteers/[id]/page.tsx`
- Modify: `web/app/dashboard/volunteers/[id]/InfoTab.tsx`
- Modify: `web/app/dashboard/volunteers/[id]/actions.ts`

- [ ] **Step 1: Fetch categories in `[id]/page.tsx`**

  Add:
  ```typescript
  const { data: categoriesData } = await admin.from('categories').select('*').eq('is_archived', false).order('sort_order')
  const categories = (categoriesData ?? []) as Category[]
  ```
  Pass `categories` to `<InfoTab>`.

- [ ] **Step 2: Update `InfoTab.tsx`**

  - Remove hardcoded `CATEGORY_OPTIONS` constant
  - Add `categories: Category[]` to props
  - Update the multi-select toggle buttons to iterate `categories` instead of `CATEGORY_OPTIONS`
  - Each button renders `cat.name` and toggles `cat.slug` in the selected slugs array

- [ ] **Step 3: Update types in `[id]/actions.ts`**

  - Change `category: VolunteerCategory` → `category: string`
  - Change `volunteer_categories?: VolunteerCategory[]` → `volunteer_categories?: string[]`
  - Remove `VolunteerCategory` from imports if no longer needed

- [ ] **Step 4: Build check**

  ```bash
  cd web && npm run build 2>&1 | grep -E "error TS" | head -20
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add web/app/dashboard/volunteers/[id]/page.tsx \
          web/app/dashboard/volunteers/[id]/InfoTab.tsx \
          web/app/dashboard/volunteers/[id]/actions.ts
  git commit -m "feat: volunteer detail InfoTab uses dynamic categories"
  ```

---

## Task 8 — Messages + Reports: Dynamic Categories

**Files:**
- Modify: `web/app/dashboard/messages/page.tsx`
- Modify: `web/app/dashboard/messages/MessagesView.tsx`
- Modify: `web/app/dashboard/reports/page.tsx`
- Modify: `web/app/dashboard/reports/ReportsView.tsx`

- [ ] **Step 1: Fetch categories in `messages/page.tsx` and `reports/page.tsx`**

  In each page, add:
  ```typescript
  const { data: categoriesData } = await admin.from('categories').select('*').eq('is_archived', false).order('sort_order')
  const categories = (categoriesData ?? []) as Category[]
  ```
  Pass `categories` to the respective View components.

- [ ] **Step 2: Update `MessagesView.tsx`**

  - Remove hardcoded `CATEGORY_LABELS` constant and `VolunteerCategory` import
  - Add `categories: Category[]` to props
  - Replace the category filter `<select>` options with: `categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)`
  - Replace `CATEGORY_LABELS[selectedCategory]` lookups with `categories.find(c => c.slug === selectedCategory)?.name ?? selectedCategory`

- [ ] **Step 3: Update `ReportsView.tsx`**

  Same pattern as MessagesView:
  - Remove any hardcoded category label/option constants
  - Add `categories: Category[]` to props
  - Replace filter dropdowns and label lookups dynamically

- [ ] **Step 4: Full production build — must pass clean**

  ```bash
  cd web && npm run build 2>&1 | tail -30
  ```
  Expected: `✓ Compiled successfully` with all routes listed. No TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  git add web/app/dashboard/messages/page.tsx \
          web/app/dashboard/messages/MessagesView.tsx \
          web/app/dashboard/reports/page.tsx \
          web/app/dashboard/reports/ReportsView.tsx
  git commit -m "feat: messages and reports use dynamic categories from DB"
  ```

---

## Task 9 — Commit All 16 Pre-Implemented Features

This task stages and commits everything that was already implemented in the working tree
(all 16 features from the previous session) that isn't yet committed.

- [ ] **Step 1: Stage all remaining tracked modified files**

  ```bash
  cd /path/to/medvolunteer
  git add web/app/apply/actions.ts
  git add web/app/dashboard/messages/MessagesView.tsx \
          web/app/dashboard/messages/actions.ts \
          web/app/dashboard/messages/page.tsx
  git add web/app/dashboard/reports/ReportsView.tsx \
          web/app/dashboard/reports/page.tsx \
          web/app/dashboard/reports/actions.ts
  git add web/app/dashboard/settings/SettingsView.tsx \
          web/app/dashboard/settings/actions.ts \
          web/app/dashboard/settings/page.tsx
  git add web/app/dashboard/shifts/ShiftsView.tsx \
          web/app/dashboard/shifts/actions.ts \
          web/app/dashboard/shifts/page.tsx
  git add web/app/dashboard/volunteers/VolunteersTable.tsx \
          web/app/dashboard/volunteers/page.tsx
  git add web/app/dashboard/volunteers/[id]/DocumentsPanel.tsx \
          web/app/dashboard/volunteers/[id]/FlagsPanel.tsx \
          web/app/dashboard/volunteers/[id]/InfoTab.tsx \
          web/app/dashboard/volunteers/[id]/VolunteerTabs.tsx \
          web/app/dashboard/volunteers/[id]/actions.ts \
          web/app/dashboard/volunteers/[id]/page.tsx
  git add web/app/volunteer/
  git add web/components/Sidebar.tsx
  git add web/types/database.ts
  git add web/vercel.json
  ```

- [ ] **Step 2: Stage all new untracked feature files**

  ```bash
  git add web/app/api/cron/
  git add web/app/dashboard/alerts/
  git add web/app/dashboard/reports/actions.ts
  git add web/lib/i18n/
  git add supabase/migrations/20260323_auto_message_rules.sql
  git add supabase/migrations/20260323_category_coordinators.sql
  git add supabase/migrations/20260323_category_requirements.sql
  git add supabase/migrations/20260323_document_provider.sql
  git add supabase/migrations/20260323_form_automation.sql
  git add supabase/migrations/20260323_holidays.sql
  git add supabase/migrations/20260323_hour_approval.sql
  git add supabase/migrations/20260323_internal_alerts.sql
  git add supabase/migrations/20260323_message_templates.sql
  git add supabase/migrations/20260323_multiple_categories.sql
  git add supabase/migrations/20260323_preferred_language.sql
  git add supabase/migrations/20260323_recurring_shifts.sql
  ```

- [ ] **Step 3: Also add the .gitignore and docs**

  ```bash
  git add .gitignore
  git add docs/
  ```

- [ ] **Step 4: Commit all 16 features in one batch commit**

  ```bash
  git commit -m "feat: implement all 16 client asks from Notion CSV

  - Recurring shifts with bulk edit (EditRecurringModal)
  - Calendar week and day views (CalendarWeekView, CalendarDayView)
  - Email templates (save, load, delete)
  - Jotform integration (API key, send request)
  - Reporting filters (date range, status, category, pipeline phase)
  - Inactive volunteer report with bulk mark-inactive
  - Hour approval (approve/reject per-entry, org toggle)
  - Add holidays + block scheduling on holidays
  - Volunteer app: reschedule shift (RescheduleModal)
  - Volunteer app: onboarding paperwork record in documents tab
  - Unresolve flags
  - Multiple categories per volunteer
  - Form automation (checkbox → auto category/flag on apply)
  - Category requirements (pre-shift eligibility rules)
  - Volunteer coordinators (head-of-team per category)
  - Preferred language setting (en/es i18n for volunteer PWA)
  - Internal alerts page + document automation rules
  - Auto message templates + cron delivery"
  ```

---

## Task 10 — Push Migrations to Supabase

- [ ] **Step 1: Confirm Supabase CLI is available and linked**

  In WSL or PowerShell with Scoop:
  ```bash
  supabase --version
  supabase status
  ```
  If not linked: `supabase link --project-ref <your-project-ref>`

- [ ] **Step 2: Push all migrations**

  ```bash
  supabase db push
  ```

  Watch for any errors on the `volunteer_categories` column type change — if Postgres rejects
  the USING clause because existing enum array data can't cast directly to text[], use this
  explicit cast in the migration instead:
  ```sql
  ALTER TABLE volunteers
    ALTER COLUMN volunteer_categories TYPE text[]
    USING ARRAY(SELECT unnest(volunteer_categories)::text);
  ```

- [ ] **Step 3: Verify in Supabase dashboard**

  Open Supabase → Table Editor → check that `categories` table exists with 5 rows seeded,
  and `volunteers.volunteer_categories` is now `text[]`.

---

## Task 11 — Final Build + Deploy

- [ ] **Step 1: Final clean production build**

  ```bash
  cd web && npm run build 2>&1
  ```
  Must exit with 0 and show `✓ Compiled successfully`.

- [ ] **Step 2: Push to GitHub (triggers Vercel auto-deploy)**

  ```bash
  git push origin main
  ```

- [ ] **Step 3: Watch Vercel deployment**

  Open https://vercel.com/dashboard or run `vercel logs` to watch the build.
  Wait for "Deployment completed" status.

- [ ] **Step 4: Smoke test on live site**

  - [ ] Admin: Settings → Categories → add a new category "Community Engagement" — appears in list
  - [ ] Admin: Volunteer → edit volunteer → new category shows in multi-select
  - [ ] Admin: Shifts → verify week/day view buttons work
  - [ ] Admin: Settings → Automation → Document Rules → create a rule with trigger keyword "cv" and assign it to your admin user. Then open any volunteer → Documents tab → upload a file named `volunteer_cv.pdf`. Go to Alerts — the new alert should appear unread.
  - [ ] Volunteer: log in → Shifts → verify "Move" / reschedule option appears
  - [ ] Volunteer: Profile → verify language toggle (EN / ES)

- [ ] **Step 5: Done — notify client the build is live**
