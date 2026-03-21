# Vercel Deploy + Client Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the MedVolunteer app live on Vercel with realistic demo data so the client can review and approve the product.

**Architecture:** CLI-driven deployment — Vercel CLI links the GitHub repo and manages env vars; Supabase CLI pushes all migrations and deploys Edge Functions to the cloud project; a one-time seed SQL file is pasted into the Supabase SQL Editor to populate demo data. GitHub auto-deploy is configured so every future `git push origin main` triggers a production redeploy.

**Tech Stack:** Vercel CLI (`vercel`), Supabase CLI (`supabase`), Next.js 15 (App Router), Supabase (Postgres + Edge Functions), GitHub

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Delete | `web/app/test/page.tsx` | Stray dev-only route — must not ship |
| Delete | `web/next.config.js` | Duplicate of `next.config.ts`; having both confuses Next.js |
| Create | `web/.env.example` | Documents all required env vars with placeholder values |
| Create | `supabase/seed-demo.sql` | One-time demo data SQL; run manually in Supabase SQL Editor |
| Create | `docs/client-preview.md` | Client-facing handoff note with live URL + guided tour |

No application source files are changed. All tasks are either file cleanup, CLI commands, or SQL authoring.

---

## Task 1: Pre-Deploy Cleanup

**Files:**
- Delete: `web/app/test/page.tsx`
- Delete: `web/next.config.js`
- Create: `web/.env.example`

- [ ] **Step 1: Delete the test page**

```bash
# From repo root
rm web/app/test/page.tsx
```

Verify it's gone: `ls web/app/test/` should show "No such file or directory".

- [ ] **Step 2: Delete the duplicate next.config.js**

`web/next.config.ts` is the authoritative config. The `.js` file is a stale CommonJS stub. Delete it:

```bash
rm web/next.config.js
```

Verify only the `.ts` remains: `ls web/next.config.*` → should show only `web/next.config.ts`.

- [ ] **Step 3: Create web/.env.example**

Create `web/.env.example` with this exact content:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email (Resend)
RESEND_API_KEY=re_your_key
```

- [ ] **Step 4: Commit**

```bash
git add web/.env.example
git rm web/app/test/page.tsx
git rm web/next.config.js
git commit -m "chore: pre-deploy cleanup (remove test page, add .env.example)"
git push origin main
```

Expected: clean push, no errors.

---

## Task 2: Vercel CLI Install + Project Link

> These are interactive CLI commands — run them in your terminal, not through Claude.

**Prerequisites:** Node.js installed, Vercel account exists at vercel.com.

- [ ] **Step 1: Install Vercel CLI**

```bash
npm i -g vercel
vercel --version   # confirm install, should print e.g. "Vercel CLI 39.x.x"
```

- [ ] **Step 2: Link the repo to a Vercel project**

From the repo root:

```bash
vercel link
```

When prompted:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your personal account or team
- **Link to existing project or create new?** → Create new
- **Project name:** `yakima-free-clinic` (this determines the subdomain: `yakima-free-clinic.vercel.app`)
- **In which directory is your code located?** → `web`
- Vercel will auto-detect Next.js. Confirm.

This creates `.vercel/project.json` in the repo root — **do not commit this file** (it's in `.gitignore`).

- [ ] **Step 3: Verify framework settings in Vercel dashboard**

Open [vercel.com/dashboard](https://vercel.com/dashboard) → select the new project → Settings → General. Confirm:

| Setting | Expected value |
|---------|---------------|
| Framework Preset | Next.js |
| Root Directory | `web` |
| Build Command | `next build` (or "Override" blank, auto-detected) |
| Output Directory | `.next` (auto-detected) |

If any are wrong, correct them now before the first deploy.

---

## Task 3: Vercel Environment Variables

> Run each command separately — you'll be prompted to paste the value securely (input is hidden).

- [ ] **Step 1: Add NEXT_PUBLIC_SUPABASE_URL**

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste: https://<your-project-ref>.supabase.co
```

Find your Supabase project URL: Supabase Dashboard → Project Settings → API → Project URL.

- [ ] **Step 2: Add NEXT_PUBLIC_SUPABASE_ANON_KEY**

```bash
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Paste: the anon/public key from Supabase Dashboard → Project Settings → API
```

- [ ] **Step 3: Add SUPABASE_SERVICE_ROLE_KEY**

```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste: the service_role key from Supabase Dashboard → Project Settings → API
# ⚠️ This key bypasses RLS — never expose it client-side
```

- [ ] **Step 4: Add RESEND_API_KEY**

```bash
vercel env add RESEND_API_KEY production
# Paste: your Resend API key (re_...)
# If you don't have Resend yet, use re_placeholder — messages page will still load, sending will fail gracefully
```

- [ ] **Step 5: Verify all 4 env vars are set**

```bash
vercel env ls production
```

Expected output lists all 4 variable names (values are hidden).

---

## Task 4: Supabase Cloud Prep

> Prerequisites: Supabase CLI installed (`npm i -g supabase`), logged in (`supabase login`), and a cloud Supabase project exists with no prior migrations applied.

- [ ] **Step 1: Link to the cloud project**

Find your project ref: Supabase Dashboard → Project Settings → General → Reference ID (a 20-char string like `abcdefghijklmnopqrst`).

```bash
supabase link --project-ref <your-project-ref>
```

Enter your database password when prompted (set when you created the Supabase project).

- [ ] **Step 2: Push all migrations**

```bash
supabase db push
```

This applies all 10 files in `supabase/migrations/` in filename order. Watch for errors — if any migration fails, fix it before continuing. **Do not run `seed-demo.sql` until this completes with no errors.**

Expected output ends with: `Finished supabase db push.`

- [ ] **Step 3: Deploy Edge Functions**

```bash
supabase functions deploy --project-ref <your-project-ref>
```

This deploys all 6 functions: `clock-in`, `clock-out`, `send-message`, `initiate-background-check`, `background-check-webhook`, `advance-onboarding` (plus `send-push` if present).

Expected: each function listed as "Deployed" with a URL.

- [ ] **Step 4: Create the demo admin user**

In the Supabase Dashboard:
1. Authentication → Users → Add user
2. Email: `admin@yakimafreeclinic.demo`
3. Password: choose a strong password (you'll share this with the client via secure channel in Task 7 — **do not write it in any committed file**)
4. Click "Create user"

The user will appear in the Users list. Note the UUID — you may need it later.

---

## Task 5: Write Demo Seed SQL

**File:** `supabase/seed-demo.sql`

> ⚠️ Only run this AFTER Task 4 Step 2 (`supabase db push`) completes successfully. The `prospect` and `volunteer` status values used below don't exist until migration `20260314000000` is applied.

- [ ] **Step 1: Create the seed file**

Create `supabase/seed-demo.sql` with the following content. Read every section before running — the file is designed to be idempotent (safe to re-run) via `ON CONFLICT DO NOTHING` or explicit UUID assignment.

```sql
-- =============================================================================
-- DEMO SEED DATA — Yakima Free Clinic
-- Run via: Supabase Dashboard → SQL Editor → paste and execute
-- Only run AFTER supabase db push completes (requires migration 20260314000000)
-- All timestamps use now() arithmetic — data stays current whenever viewed
-- =============================================================================

-- ── 1. Update org name ────────────────────────────────────────────────────────
-- The initial seed migration created this org as "City Free Clinic"

UPDATE organizations
  SET name = 'Yakima Free Clinic'
  WHERE id = '00000000-0000-0000-0000-000000000001';

-- ── 2. Add third location ─────────────────────────────────────────────────────
-- Existing: Main Clinic (…010), East Side Outreach (…011)
-- Update East Side Outreach to East Valley Site, add Mobile Unit

UPDATE locations
  SET name = 'East Valley Site'
  WHERE id = '00000000-0000-0000-0000-000000000011';

INSERT INTO locations (id, org_id, name, address, lat, lng, geofence_radius_meters)
VALUES (
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000001',
  'Mobile Unit',
  '789 River Rd, Yakima, WA 98901',
  46.6021, -120.5059, 150
) ON CONFLICT (id) DO NOTHING;

-- ── 3. Volunteers (14) ────────────────────────────────────────────────────────
-- Using pipeline_phase enum: intake, orientation, review, training, active, offboarding
-- Using volunteer_status enum: applicant, prospect, volunteer, inactive
-- user_id is NULL for all demo volunteers (no auth accounts)

INSERT INTO volunteers
  (id, org_id, first_name, last_name, email, phone, category, status, pipeline_phase)
VALUES
  -- Active medical professionals (3)
  ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-000000000001',
   'Sarah','Chen','sarah.chen@demo.test','509-555-0101',
   'medical_professional','volunteer','active'),
  ('00000000-0000-0000-0000-00000000a002','00000000-0000-0000-0000-000000000001',
   'James','Torres','james.torres@demo.test','509-555-0102',
   'medical_professional','volunteer','active'),
  ('00000000-0000-0000-0000-00000000a003','00000000-0000-0000-0000-000000000001',
   'Maria','Rivera','maria.rivera@demo.test','509-555-0103',
   'medical_professional','volunteer','active'),
  -- Active support staff (2)
  ('00000000-0000-0000-0000-00000000a004','00000000-0000-0000-0000-000000000001',
   'Linda','Park','linda.park@demo.test','509-555-0104',
   'support_staff','volunteer','active'),
  ('00000000-0000-0000-0000-00000000a005','00000000-0000-0000-0000-000000000001',
   'Tom','Walsh','tom.walsh@demo.test','509-555-0105',
   'support_staff','volunteer','active'),
  -- Prospects — orientation phase (2 medical)
  ('00000000-0000-0000-0000-00000000a006','00000000-0000-0000-0000-000000000001',
   'Kevin','Okafor','kevin.okafor@demo.test','509-555-0106',
   'medical_professional','prospect','orientation'),
  ('00000000-0000-0000-0000-00000000a007','00000000-0000-0000-0000-000000000001',
   'Priya','Nair','priya.nair@demo.test','509-555-0107',
   'medical_professional','prospect','orientation'),
  -- Prospects — training phase (2 trainees)
  ('00000000-0000-0000-0000-00000000a008','00000000-0000-0000-0000-000000000001',
   'Alex','Kim','alex.kim@demo.test','509-555-0108',
   'trainee','prospect','training'),
  ('00000000-0000-0000-0000-00000000a009','00000000-0000-0000-0000-000000000001',
   'Jordan','Lee','jordan.lee@demo.test','509-555-0109',
   'trainee','prospect','training'),
  -- Applicants — intake (2)
  ('00000000-0000-0000-0000-00000000a00a','00000000-0000-0000-0000-000000000001',
   'Sam','Carter','sam.carter@demo.test','509-555-0110',
   'other','applicant','intake'),
  ('00000000-0000-0000-0000-00000000a00b','00000000-0000-0000-0000-000000000001',
   'Riley','Morgan','riley.morgan@demo.test','509-555-0111',
   'other','applicant','intake'),
  -- Inactive support staff — offboarding (2)
  ('00000000-0000-0000-0000-00000000a00c','00000000-0000-0000-0000-000000000001',
   'David','Kim','david.kim@demo.test','509-555-0112',
   'support_staff','inactive','offboarding'),
  ('00000000-0000-0000-0000-00000000a00d','00000000-0000-0000-0000-000000000001',
   'Nancy','Brown','nancy.brown@demo.test','509-555-0113',
   'support_staff','inactive','offboarding'),
  -- Active admin (1)
  ('00000000-0000-0000-0000-00000000a00e','00000000-0000-0000-0000-000000000001',
   'Robert','Chen','robert.chen@demo.test','509-555-0114',
   'admin','volunteer','active')
ON CONFLICT (id) DO NOTHING;

-- ── 4. Shifts (10) ────────────────────────────────────────────────────────────
-- Clear the 2 placeholder shifts from the initial seed migration first
DELETE FROM shifts
  WHERE id IN (
    '00000000-0000-0000-0000-000000000060',
    '00000000-0000-0000-0000-000000000061'
  );

-- 4 past shifts (completed)
INSERT INTO shifts (id, org_id, location_id, name, start_time, end_time, required_count)
VALUES
  ('00000000-0000-0000-0000-000000000070',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'Saturday Morning Clinic',
   now() - interval '28 days', now() - interval '28 days' + interval '4 hours', 4),
  ('00000000-0000-0000-0000-000000000071',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000011',
   'Tuesday Evening Outreach',
   now() - interval '21 days', now() - interval '21 days' + interval '3 hours', 3),
  ('00000000-0000-0000-0000-000000000072',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'Wednesday Afternoon Clinic',
   now() - interval '14 days', now() - interval '14 days' + interval '5 hours', 4),
  ('00000000-0000-0000-0000-000000000073',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000012',
   'Mobile Unit — River District',
   now() - interval '7 days', now() - interval '7 days' + interval '3 hours', 3),
  -- 4 upcoming partially filled
  ('00000000-0000-0000-0000-000000000074',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'Saturday Morning Clinic',
   now() + interval '2 days', now() + interval '2 days' + interval '4 hours', 4),
  ('00000000-0000-0000-0000-000000000075',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000011',
   'Tuesday Evening Outreach',
   now() + interval '5 days', now() + interval '5 days' + interval '3 hours', 4),
  ('00000000-0000-0000-0000-000000000076',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000012',
   'Mobile Unit — East Valley',
   now() + interval '8 days', now() + interval '8 days' + interval '3 hours', 4),
  ('00000000-0000-0000-0000-000000000077',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'Wednesday Afternoon Clinic',
   now() + interval '12 days', now() + interval '12 days' + interval '5 hours', 4),
  -- 2 upcoming fully staffed
  ('00000000-0000-0000-0000-000000000078',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'Saturday Morning Clinic (Full)',
   now() + interval '9 days', now() + interval '9 days' + interval '4 hours', 3),
  ('00000000-0000-0000-0000-000000000079',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000011',
   'Tuesday Evening Outreach (Full)',
   now() + interval '14 days', now() + interval '14 days' + interval '3 hours', 2)
ON CONFLICT (id) DO NOTHING;

-- ── 5. Shift assignments ──────────────────────────────────────────────────────
-- Past shifts: fully assigned
INSERT INTO shift_assignments (shift_id, volunteer_id, role)
VALUES
  -- Shift 70 (4 assigned, required_count=4)
  ('00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-00000000a001','Physician'),
  ('00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-00000000a002','Physician'),
  ('00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-00000000a004','Check-in'),
  ('00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-00000000a005','Check-in'),
  -- Shift 71 (3 assigned, required_count=3)
  ('00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-00000000a001','Physician'),
  ('00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-00000000a003','Physician'),
  ('00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-00000000a005','Support'),
  -- Shift 72 (4 assigned, required_count=4)
  ('00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-00000000a001','Physician'),
  ('00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-00000000a002','Physician'),
  ('00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-00000000a003','Physician'),
  ('00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-00000000a004','Admin'),
  -- Shift 73 (3 assigned, required_count=3)
  ('00000000-0000-0000-0000-000000000073','00000000-0000-0000-0000-00000000a002','Physician'),
  ('00000000-0000-0000-0000-000000000073','00000000-0000-0000-0000-00000000a004','Support'),
  ('00000000-0000-0000-0000-000000000073','00000000-0000-0000-0000-00000000a005','Support'),
  -- Upcoming partially filled (2–3 of 4 slots)
  ('00000000-0000-0000-0000-000000000074','00000000-0000-0000-0000-00000000a001','Physician'),
  ('00000000-0000-0000-0000-000000000074','00000000-0000-0000-0000-00000000a003','Physician'),
  ('00000000-0000-0000-0000-000000000075','00000000-0000-0000-0000-00000000a002','Physician'),
  ('00000000-0000-0000-0000-000000000075','00000000-0000-0000-0000-00000000a004','Support'),
  ('00000000-0000-0000-0000-000000000076','00000000-0000-0000-0000-00000000a001','Physician'),
  ('00000000-0000-0000-0000-000000000076','00000000-0000-0000-0000-00000000a005','Support'),
  ('00000000-0000-0000-0000-000000000077','00000000-0000-0000-0000-00000000a003','Physician'),
  -- Upcoming fully staffed
  ('00000000-0000-0000-0000-000000000078','00000000-0000-0000-0000-00000000a001','Physician'),
  ('00000000-0000-0000-0000-000000000078','00000000-0000-0000-0000-00000000a002','Physician'),
  ('00000000-0000-0000-0000-000000000078','00000000-0000-0000-0000-00000000a004','Support'),
  ('00000000-0000-0000-0000-000000000079','00000000-0000-0000-0000-00000000a003','Physician'),
  ('00000000-0000-0000-0000-000000000079','00000000-0000-0000-0000-00000000a005','Support')
ON CONFLICT (shift_id, volunteer_id) DO NOTHING;

-- ── 6. Time entries ───────────────────────────────────────────────────────────
-- Past shifts: completed entries (clock_in + clock_out populated)
-- duration_minutes is a generated column — do NOT insert it

INSERT INTO time_entries (volunteer_id, shift_id, location_id, clock_in, clock_out, method)
VALUES
  -- Shift 70 (28 days ago)
  ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000010',
   now() - interval '28 days', now() - interval '28 days' + interval '4 hours', 'geofence'),
  ('00000000-0000-0000-0000-00000000a002','00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000010',
   now() - interval '28 days', now() - interval '28 days' + interval '3 hours 50 minutes', 'geofence'),
  ('00000000-0000-0000-0000-00000000a004','00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000010',
   now() - interval '28 days', now() - interval '28 days' + interval '4 hours 10 minutes', 'geofence'),
  -- Shift 71 (21 days ago)
  ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000011',
   now() - interval '21 days', now() - interval '21 days' + interval '3 hours', 'geofence'),
  ('00000000-0000-0000-0000-00000000a003','00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000011',
   now() - interval '21 days', now() - interval '21 days' + interval '2 hours 45 minutes', 'geofence'),
  -- Shift 72 (14 days ago)
  ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-000000000010',
   now() - interval '14 days', now() - interval '14 days' + interval '5 hours', 'geofence'),
  ('00000000-0000-0000-0000-00000000a002','00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-000000000010',
   now() - interval '14 days', now() - interval '14 days' + interval '4 hours 30 minutes', 'geofence'),
  ('00000000-0000-0000-0000-00000000a003','00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-000000000010',
   now() - interval '14 days', now() - interval '14 days' + interval '5 hours', 'geofence'),
  -- Shift 73 (7 days ago)
  ('00000000-0000-0000-0000-00000000a002','00000000-0000-0000-0000-000000000073','00000000-0000-0000-0000-000000000012',
   now() - interval '7 days', now() - interval '7 days' + interval '3 hours', 'geofence'),
  ('00000000-0000-0000-0000-00000000a005','00000000-0000-0000-0000-000000000073','00000000-0000-0000-0000-000000000012',
   now() - interval '7 days', now() - interval '7 days' + interval '2 hours 55 minutes', 'geofence');

-- Open time entry: volunteer currently "clocked in" — populates "Clocked In Now" KPI card
-- clock_out is NULL intentionally; shift_id points at the upcoming Saturday clinic
INSERT INTO time_entries (volunteer_id, shift_id, location_id, clock_in, method)
VALUES (
  '00000000-0000-0000-0000-00000000a004',
  '00000000-0000-0000-0000-000000000074',
  '00000000-0000-0000-0000-000000000010',
  now() - interval '2 hours',
  'manual'
);

-- ── 7. Credentials (3 expiring soon) ─────────────────────────────────────────
-- Expiration between now + 5 days and now + 25 days → populates Expiring Credentials alert

INSERT INTO credentials (id, volunteer_id, type, license_number, issuing_body, expiration_date)
VALUES
  ('00000000-0000-0000-0000-000000000080',
   '00000000-0000-0000-0000-00000000a001',
   'Medical License', 'WA-MD-45123', 'WA State DOH',
   (now() + interval '8 days')::date),
  ('00000000-0000-0000-0000-000000000081',
   '00000000-0000-0000-0000-00000000a002',
   'CPR Certification', 'CPR-2024-88901', 'American Heart Association',
   (now() + interval '15 days')::date),
  ('00000000-0000-0000-0000-000000000082',
   '00000000-0000-0000-0000-00000000a003',
   'Medical License', 'WA-MD-51234', 'WA State DOH',
   (now() + interval '22 days')::date)
ON CONFLICT (id) DO NOTHING;

-- ── 8. Messages (2 sent) ──────────────────────────────────────────────────────

INSERT INTO messages (id, org_id, subject, body, channel, recipient_type, recipient_filter, sent_at, status)
VALUES
  ('00000000-0000-0000-0000-000000000090',
   '00000000-0000-0000-0000-000000000001',
   'Thank You for Your Service This Month',
   'Dear Volunteers, Thank you for your incredible dedication this month. We served over 120 patients across all three sites. Your commitment makes this possible. — Yakima Free Clinic Staff',
   'email', 'all', '{}',
   now() - interval '5 days', 'sent'),
  ('00000000-0000-0000-0000-000000000091',
   '00000000-0000-0000-0000-000000000001',
   'Upcoming Shift Reminder — Medical Team',
   'Reminder: Saturday Morning Clinic is coming up. Please confirm your attendance by replying to this message.',
   'sms', 'group', '{"category": "medical_professional"}',
   now() - interval '2 days', 'sent')
ON CONFLICT (id) DO NOTHING;

-- Message recipients for email blast (all 5 active volunteers)
INSERT INTO message_recipients (message_id, volunteer_id, delivered_at, read_at)
VALUES
  ('00000000-0000-0000-0000-000000000090','00000000-0000-0000-0000-00000000a001', now() - interval '5 days', now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000090','00000000-0000-0000-0000-00000000a002', now() - interval '5 days', now() - interval '4 days 12 hours'),
  ('00000000-0000-0000-0000-000000000090','00000000-0000-0000-0000-00000000a003', now() - interval '5 days', NULL),
  ('00000000-0000-0000-0000-000000000090','00000000-0000-0000-0000-00000000a004', now() - interval '5 days', now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000090','00000000-0000-0000-0000-00000000a005', now() - interval '5 days', NULL),
  -- SMS to medical_professional group (3 volunteers)
  ('00000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-00000000a001', now() - interval '2 days', now() - interval '1 day 20 hours'),
  ('00000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-00000000a002', now() - interval '2 days', now() - interval '1 day 18 hours'),
  ('00000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-00000000a003', now() - interval '2 days', NULL)
ON CONFLICT DO NOTHING;

-- ── 9. Lesson completions (partial progress for Reports) ──────────────────────
-- Uses existing lessons from the initial seed migration:
--   lesson 050 = Intro to Volunteer Safety (module 040)
--   lesson 051 = Safety Quiz (module 040)
--   lesson 052 = HIPAA Basics (module 041)

INSERT INTO lesson_completions (volunteer_id, lesson_id, completed_at, score, time_spent_seconds)
VALUES
  -- Sarah Chen: all 3 lessons complete
  ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-000000000050', now() - interval '20 days', NULL, 920),
  ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-000000000051', now() - interval '20 days', 90, 680),
  ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-000000000052', now() - interval '18 days', NULL, 1240),
  -- James Torres: 2 of 3 complete (no HIPAA yet)
  ('00000000-0000-0000-0000-00000000a002','00000000-0000-0000-0000-000000000050', now() - interval '15 days', NULL, 880),
  ('00000000-0000-0000-0000-00000000a002','00000000-0000-0000-0000-000000000051', now() - interval '15 days', 85, 720),
  -- Kevin Okafor: 1 of 3 (just started)
  ('00000000-0000-0000-0000-00000000a006','00000000-0000-0000-0000-000000000050', now() - interval '3 days', NULL, 960)
ON CONFLICT (volunteer_id, lesson_id) DO NOTHING;

-- ── 10. Onboarding progress (2 volunteers in progress) ────────────────────────
-- Uses existing onboarding stages from the initial seed migration:
--   stage 030 = Submit Application (order 1)
--   stage 031 = Background Check (order 2)
--   stage 032 = Sign Volunteer Agreement (order 3)
--   stage 033 = Orientation Meeting (order 4)
--   stage 034 = Complete Safety Training (order 5)

INSERT INTO onboarding_progress (volunteer_id, stage_id, completed_at)
VALUES
  -- Kevin Okafor: completed stages 1-2, in progress on stage 3
  ('00000000-0000-0000-0000-00000000a006','00000000-0000-0000-0000-000000000030', now() - interval '10 days'),
  ('00000000-0000-0000-0000-00000000a006','00000000-0000-0000-0000-000000000031', now() - interval '5 days'),
  -- Priya Nair: completed stage 1 only
  ('00000000-0000-0000-0000-00000000a007','00000000-0000-0000-0000-000000000030', now() - interval '7 days')
ON CONFLICT (volunteer_id, stage_id) DO NOTHING;
```

- [ ] **Step 2: Commit the seed file to the repo**

```bash
git add supabase/seed-demo.sql
git commit -m "chore: add demo seed data for client preview"
git push origin main
```

Note: This commits the SQL file (which contains no secrets — only fake demo data), so it's safe to push. You will run it in the next step.

---

## Task 6: Run Demo Seed + Trigger Deploy

- [ ] **Step 1: Run seed SQL in Supabase SQL Editor**

1. Open Supabase Dashboard → SQL Editor
2. Paste the entire contents of `supabase/seed-demo.sql`
3. Click "Run"

Expected: `Success. No rows returned.` (or small row counts for each statement). If any statement fails, read the error — most likely cause is the migrations haven't been applied yet (re-run Task 4 Step 2 first).

- [ ] **Step 2: Trigger production deploy**

The seed SQL commit from Task 5 Step 2 already pushed to `main`, which should have triggered an auto-deploy. Check in the Vercel dashboard:

1. Open [vercel.com/dashboard](https://vercel.com/dashboard) → your project → Deployments
2. Confirm the latest deployment shows "Ready" (green)
3. If it shows "Building", wait ~2 minutes

If no deploy was triggered (GitHub integration not connected), run manually:

```bash
vercel --prod
```

- [ ] **Step 3: Spot-check the live URL**

Visit `https://yakima-free-clinic.vercel.app` (or your actual subdomain from Vercel) and verify each page:

| Page | What to verify |
|------|---------------|
| `/login` | Login form loads, no console errors |
| Sign in with `admin@yakimafreeclinic.demo` + password | Redirects to `/dashboard` |
| `/dashboard` | KPI cards show non-zero numbers: "Clocked In Now" ≥ 1, "Hours This Month" > 0, "Open Shifts" > 0; Expiring Credentials alert card visible |
| `/dashboard/volunteers` | 14 volunteers listed; status and filter dropdowns work |
| `/dashboard/shifts` | Calendar shows upcoming shifts; past shifts visible; clicking a shift opens roster panel |
| `/dashboard/reports` | Hours tab shows data for at least 3 volunteers; Credentials tab shows 3 expiring items |
| `/dashboard/messages` | 2 sent messages appear in history; delivery stats show (5 recipients / 3 recipients) |
| `/volunteer/login` | Volunteer PWA login page loads without errors |

If the build fails: click the failed deployment → View Build Logs → look for the first red error. Most likely causes:
- Missing env var → add it with `vercel env add` and redeploy
- TypeScript error → fix the file and push a new commit

---

## Task 7: Write Client Handoff Note

**File:** `docs/client-preview.md`

> ⚠️ Commit only the demo email address — NOT the password. Share the password with the client via secure channel (email, 1Password, text, etc.).

- [ ] **Step 1: Create the handoff note**

Create `docs/client-preview.md`:

```markdown
# Yakima Free Clinic — Client Preview

## Live URL

**<https://yakima-free-clinic.vercel.app>**

## Demo Login

- **Email:** admin@yakimafreeclinic.demo
- **Password:** *(shared separately via secure channel)*

---

## Guided Tour

### 1. Dashboard
After logging in you land on the main dashboard. The KPI cards at the top show:
- **Clocked In Now** — volunteers currently on-site
- **Hours This Month** — total volunteer hours logged
- **Open Shifts** — upcoming shifts that still need volunteers

Below the KPIs, the **Expiring Credentials** alert card lists volunteers whose licenses or certifications expire within 30 days.

### 2. Volunteers
Navigate to **Volunteers** in the sidebar. You'll see a list of 14 volunteers with their status, category, and pipeline phase. Use the filter dropdowns to narrow by status or category.

Click any volunteer's name to open their detail page, which includes tabs for:
- **Info** — contact details, emergency contact
- **Pipeline** — onboarding progress through 6 phases
- **Credentials** — licenses and certifications with expiry dates
- **Hours** — complete time-entry history
- **Documents** — signed agreements and uploads

### 3. Shifts
The **Shifts** page shows a calendar view of all scheduled shifts. Click any shift chip to open the **Roster Panel** on the right, which lists all assigned volunteers and their roles.

Toggle to **List View** for a compact table of all upcoming shifts.

### 4. Reports
The **Reports** page has three tabs:
- **Hours** — volunteer hours broken down by person and date range
- **Onboarding** — completion rates per stage across all volunteers
- **Credentials** — full expiry table, filterable by status

### 5. Messages
The **Messages** page shows the history of sent communications. You can see delivery and read stats for each message. Click **Compose** to draft a new email or SMS, targeting all volunteers, a specific category, or selected individuals.

### 6. Volunteer PWA
Visit **/volunteer/login** to see the mobile experience volunteers use. (Demo volunteer accounts not yet provisioned — this shows the login UI and onboarding flow.)

---

## Notes

- All data shown is sample/demo data for review purposes only.
- The URL (`vercel.app` subdomain) is temporary. A custom domain will be configured before public launch.
- The app is deployed on Vercel's free tier with automatic deploys from the GitHub `main` branch.
```

- [ ] **Step 2: Commit and push**

```bash
git add docs/client-preview.md
git commit -m "docs: add client preview handoff note"
git push origin main
```

- [ ] **Step 3: Share the password**

Send the demo admin password to the client via a secure channel (email, 1Password share link, Signal, etc.). Do not paste it into Slack, GitHub issues, or any unencrypted channel.

---

## Success Checklist

Before sharing the URL with the client, confirm all of these:

- [ ] Live URL is publicly accessible (no login required to reach `/login`)
- [ ] Admin login works with `admin@yakimafreeclinic.demo`
- [ ] Dashboard KPI cards show non-zero data
- [ ] Expiring Credentials alert is visible on dashboard
- [ ] Volunteers list shows 14 volunteers; status filters work
- [ ] Shifts calendar shows past and upcoming shifts; roster panel opens on click
- [ ] Reports → Hours shows data for multiple volunteers
- [ ] Reports → Credentials shows 3 expiring items
- [ ] Messages history shows 2 sent messages with delivery stats
- [ ] `/volunteer/login` page loads without errors
- [ ] No red console errors on key pages (open DevTools → Console)
- [ ] `docs/client-preview.md` committed (email only, no password)
- [ ] Password shared with client via secure channel
