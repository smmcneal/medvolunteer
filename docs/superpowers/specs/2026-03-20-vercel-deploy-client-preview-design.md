# Design: Vercel Deploy for Client Approval

**Date:** 2026-03-20
**Project:** MedVolunteer — Yakima Free Clinic Admin Dashboard + Volunteer PWA
**Goal:** Get the fully-built web app live on Vercel with realistic demo data so the client can review and approve the product.

---

## Context

The app is a Next.js 15 application with:
- Admin dashboard (`/dashboard/*`) — volunteer management, shifts, reports, messages, documents, settings
- Volunteer PWA (`/volunteer/*`) — shift clock-in, learning, messaging, profile
- Supabase backend (auth, database, edge functions in `supabase/functions/`)
- All pages fully implemented; currently running on local Supabase (`127.0.0.1:54321`)
- GitHub repo: `smmcneal/medvolunteer`, branch `main`
- The initial seed migration (`20260313221902_seed_data.sql`) already seeds an org with UUID `00000000-0000-0000-0000-000000000001` named "City Free Clinic" — the demo seed SQL must build on top of this rather than create a new org.

Hosting: Vercel (free tier) + existing Supabase cloud project. No custom domain yet — Vercel subdomain is sufficient for client approval.

---

## Approach

CLI-driven deployment via Vercel CLI + Supabase CLI. GitHub integration set up so every future push to `main` auto-deploys. One-time seed SQL populates the cloud database with realistic demo data.

---

## Section 1: Pre-deploy Cleanup

**Files to change:**

1. **Delete** `web/app/test/page.tsx` — stray dev-only route, must not be publicly accessible
2. **Delete** `web/next.config.js` — duplicate of `next.config.ts`; keep only `.ts`
3. **Create** `web/.env.example` — documents all required env vars with placeholder values (no real secrets):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email (Resend)
RESEND_API_KEY=re_your_key
```

Commit message: `chore: pre-deploy cleanup (remove test page, add .env.example)`

---

## Section 2: Vercel Project Setup

**Prerequisites:** Node.js installed, Vercel account exists.

**Steps:**

```bash
npm i -g vercel          # install CLI (one-time)
vercel link              # connect repo → creates Vercel project, enables GitHub auto-deploy
```

During `vercel link`:
- Select "Link to existing project" or create new
- Project name determines subdomain: e.g. `yakima-free-clinic` → `yakima-free-clinic.vercel.app`
- Root directory: `web`
- Vercel will auto-detect Next.js framework

**Verify in Vercel project settings after linking:**
- Framework Preset = **Next.js**
- Root Directory = **`web`**
- Build Command = **`next build`**
- Output Directory = **`.next`** (auto-detected)

If any of these are wrong, correct them in the Vercel dashboard before the first deploy.

**Set production environment variables** (one per command, value entered securely at the prompt):

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add RESEND_API_KEY production
```

After setup, every `git push origin main` triggers an automatic production deploy.

---

## Section 3: Supabase Cloud Prep

**Prerequisites:** Supabase CLI installed (`npm i -g supabase`), Supabase cloud project exists and is empty (no prior migrations applied).

**Steps:**

```bash
supabase link --project-ref <project-ref>   # link to cloud project
supabase db push                             # apply ALL migrations in order
supabase functions deploy --project-ref <project-ref>   # deploy all Edge Functions
```

The `project-ref` is the alphanumeric ID from the Supabase dashboard URL.

`supabase db push` applies every file in `supabase/migrations/` in filename order, including the initial schema and the existing seed migration (`20260313221902_seed_data.sql`). **Do not run `seed-demo.sql` until `db push` completes with no errors** — the seed SQL depends on the updated `volunteer_status` enum values (`prospect`, `volunteer`) introduced in migration `20260314000000`, which only exist after all migrations are applied.

The Edge Functions (`clock-in`, `clock-out`, `send-message`, etc.) are required for the volunteer PWA clock-in flow shown in the client handoff tour.

**Create demo admin user:**
- Supabase Dashboard → Authentication → Users → Add user
- Email: `admin@yakimafreeclinic.demo`
- Password: strong password (share with client via secure channel — see Section 6)

---

## Section 4: Demo Seed Data

**File:** `supabase/seed-demo.sql`

Run via: Supabase Dashboard → SQL Editor → paste and execute.

> ⚠️ Only run after `supabase db push` completes successfully.

> ⚠️ All timestamps must use `now()` arithmetic (e.g. `now() - interval '3 days'`), never hardcoded date literals — data must stay in-window whenever the client views it.

### Org: update existing (do not insert new)

The initial seed migration already created the org with UUID `00000000-0000-0000-0000-000000000001`. The demo seed patches the name only:

```sql
UPDATE organizations SET name = 'Yakima Free Clinic' WHERE id = '00000000-0000-0000-0000-000000000001';
```

### Locations (3)

- Main Clinic
- East Valley Site
- Mobile Unit

### Volunteers (14)

All inserted with `org_id = '00000000-0000-0000-0000-000000000001'`. Spread across statuses and categories using the updated enum values from migration `20260314000000`:

| Count | status | category | pipeline_phase |
|-------|--------|----------|----------------|
| 3 | volunteer | medical_professional | active |
| 2 | volunteer | support_staff | active |
| 2 | prospect | medical_professional | orientation |
| 1 | prospect | trainee | training |
| 1 | prospect | trainee | training |
| 2 | applicant | other | intake |
| 2 | inactive | support_staff | offboarding |
| 1 | volunteer | admin | active |

### Shifts (10)

- 4 past shifts (`start_time` between `now() - interval '28 days'` and `now() - interval '7 days'`) with `shift_assignments` and completed `time_entries` (both `clock_in` and `clock_out` set, `duration_minutes` populated) — drives Hours report data
- 4 upcoming shifts (`start_time` between `now() + interval '2 days'` and `now() + interval '14 days'`), partially filled (2–3 of 4 required slots) via `shift_assignments`
- 2 upcoming shifts fully staffed (`assignments.length = required_count`) — progress bars show green
- 1–2 shifts have an open `time_entry` (`clock_out IS NULL`) for a volunteer currently "clocked in" — populates the "Clocked In Now" KPI card on the dashboard

### Credentials

3 volunteers receive credentials with `expiration_date` between `now() + interval '5 days'` and `now() + interval '25 days'` — populates the dashboard "Expiring Credentials" alert card on first login.

### Messages (2)

- 1 email blast sent to all volunteers, `sent_at = now() - interval '5 days'`
- 1 SMS to `medical_professional` group, `sent_at = now() - interval '2 days'`
- Both include `message_recipients` rows for delivery stats

### Learning

- 1 onboarding module ("New Volunteer Orientation") with 3 lessons
- `lesson_completions` rows for 3 volunteers (partial progress visible in Reports)

### Onboarding Workflow

- 1 workflow with 5 stages
- `onboarding_progress` rows for 2 volunteers with `completed_at` set on 2–3 stages each

---

## Section 5: Deploy & Verify

After the seed runs:

1. `git push origin main` — triggers automatic Vercel build
2. Monitor build in Vercel dashboard — confirm green deploy
3. Visit live URL and verify:
   - `/login` → sign in with demo admin credentials
   - `/dashboard` → KPI cards show real numbers (volunteers clocked in, hours this month, open shifts; expiring credentials alert visible)
   - `/dashboard/volunteers` → 14 volunteers listed, filters work
   - `/dashboard/shifts` → calendar shows past and upcoming shifts, click opens roster panel
   - `/dashboard/reports` → Hours tab shows data, Credentials tab shows expiring items
   - `/dashboard/messages` → 2 sent messages in history
   - `/volunteer/login` → volunteer PWA login page loads

If the build fails: check Vercel build logs for the specific error (most likely a missing env var or TypeScript error) and fix before sharing the URL.

---

## Section 6: Client Handoff Note

**File:** `docs/client-preview.md`

> ⚠️ Commit this file with the demo email address only — do NOT commit the password. Share the password with the client via secure channel (email, 1Password, etc.)

Contents:
- Live URL (e.g. `https://yakima-free-clinic.vercel.app`)
- Demo admin login: `admin@yakimafreeclinic.demo` / *(password shared separately)*
- Guided tour:
  1. **Dashboard** — KPI cards (clocked-in volunteers, hours this month, open shifts), expiring credentials alert
  2. **Volunteers** — list with filters, click any volunteer to see detail tabs (Info, Pipeline, Credentials, Hours, Documents)
  3. **Shifts** — calendar view, click a shift to open the roster panel, view assigned volunteers
  4. **Reports** — Hours breakdown by volunteer, Onboarding completion rates, Credential expiry table
  5. **Messages** — view sent message history, try composing a new message
  6. **Volunteer PWA** — visit `/volunteer/login` to see the mobile experience (separate login for volunteers)
- Note: data is sample/demo data for review purposes
- Note: domain is temporary; custom domain will be configured before public launch

Commit `docs/client-preview.md` (without password) to `main`.

---

## Build Sequence

1. Pre-deploy cleanup → commit + push to `main`
2. `npm i -g vercel` → `vercel link` → verify framework settings → `vercel env add` (×4)
3. `supabase link` → `supabase db push` → `supabase functions deploy` → create admin user in Supabase dashboard
4. Write `supabase/seed-demo.sql` → run in Supabase SQL editor (only after step 3 fully complete)
5. `git push origin main` → monitor Vercel build → spot-check live URL
6. Write `docs/client-preview.md` (email only, no password) → commit + push → share password with client via secure channel

**Estimated time:** ~45 minutes end-to-end

---

## Success Criteria

- [ ] Live URL is publicly accessible
- [ ] Admin login works with demo credentials
- [ ] Dashboard KPI cards show non-zero data (clocked in, hours, open shifts)
- [ ] Expiring credentials alert is visible on dashboard
- [ ] Volunteers list shows 14 volunteers, filters work
- [ ] Shifts calendar shows upcoming and past shifts with roster panel working
- [ ] Reports pages show meaningful data (hours, onboarding, credentials)
- [ ] Messages history shows 2 sent messages
- [ ] Edge Functions deployed (volunteer clock-in works in PWA)
- [ ] No console errors on key pages
- [ ] Client handoff note committed (email only) and password shared securely
