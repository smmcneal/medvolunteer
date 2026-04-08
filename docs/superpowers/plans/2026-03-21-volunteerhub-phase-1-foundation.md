# VolunteerHub Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new Next.js 15 project with multi-tenant path routing, Supabase schema, vertical config system, and OrgProvider context — so any org slug renders its branded dashboard with correct vertical labels.

**Architecture:** Single Next.js 15 App Router project. Path-based multi-tenancy via `app/[orgSlug]/layout.tsx`, which loads the org from Supabase, resolves vertical labels via a TypeScript config registry, and injects everything into React context. All UI reads labels from context — no hardcoded strings.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS v4, Supabase (PostgreSQL + RLS + Auth), Radix UI, Lucide React, Vitest (unit tests for pure functions)

**Reference codebase:** `/c/Users/smmcn/Desktop/medvolunteer/web/` — copy design tokens, Supabase helpers, and type patterns from here. Do not copy-paste pages; use as reference only.

---

## File Map

| File | Responsibility |
|------|---------------|
| `app/layout.tsx` | Root HTML shell, fonts (Syne + Figtree), global CSS |
| `app/globals.css` | Design tokens (navy/teal palette, shadows, spacing) — port from medvolunteer |
| `app/page.tsx` | Placeholder marketing homepage (just brand name + "coming soon") |
| `app/[orgSlug]/layout.tsx` | Loads org by slug, resolves vertical + labels, renders `<OrgProvider>` |
| `app/[orgSlug]/dashboard/page.tsx` | Placeholder dashboard — imports DebugPanel client component |
| `app/[orgSlug]/dashboard/_debug-panel.tsx` | Client component that reads OrgContext and renders debug info |
| `app/[orgSlug]/not-found.tsx` | 404 when org slug doesn't exist |
| `verticals/types.ts` | `VerticalConfig`, `OrgLabels`, `OnboardingStageTemplate` interfaces |
| `verticals/index.ts` | `VERTICALS` registry, `getVerticalConfig()`, `mergeLabels()` |
| `verticals/medical.ts` | Medical/clinic vertical config |
| `verticals/animal-shelter.ts` | Animal shelter/rescue vertical config |
| `verticals/food-bank.ts` | Food bank/pantry vertical config |
| `verticals/nonprofit.ts` | General non-profit vertical config |
| `lib/supabase/client.ts` | Browser Supabase client (SSR-safe singleton) |
| `lib/supabase/server.ts` | Server Supabase client (async cookies) |
| `lib/supabase/admin.ts` | Service-role client (bypasses RLS) |
| `lib/org.ts` | `getOrgBySlug(slug)` — server-side org fetch + not-found handling |
| `contexts/org-context.tsx` | `OrgProvider` component + `useOrg()` hook |
| `supabase/migrations/20260321000001_initial_schema.sql` | All tables (ported from medvolunteer + 4 new columns/tables) |
| `supabase/seed.sql` | Two seed orgs: one medical, one animal-shelter — for local dev |
| `vitest.config.ts` | Vitest config for unit tests |
| `vitest/__tests__/verticals.test.ts` | Tests for `getVerticalConfig()` and `mergeLabels()` |

---

## Task 1: Scaffold the project

**Files:**
- Create: `volunteerhub/` (new directory at `C:/Users/smmcn/Desktop/volunteerhub`)
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`

- [ ] **Step 1: Run create-next-app**

```bash
cd C:/Users/smmcn/Desktop
npx create-next-app@latest volunteerhub \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
cd volunteerhub
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr \
  @radix-ui/react-avatar @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-select @radix-ui/react-tabs \
  lucide-react clsx tailwind-merge
```

- [ ] **Step 3: Install dev dependencies (Vitest)**

```bash
npm install -D vitest @vitest/ui happy-dom
```

- [ ] **Step 4: Verify project boots**

```bash
npm run dev
```

Expected: `ready on http://localhost:3000` with no errors. Open browser to confirm.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 project with dependencies"
```

---

## Task 2: Port design system

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `tailwind.config.ts`

**Reference:** `C:/Users/smmcn/Desktop/medvolunteer/web/app/globals.css` and `web/app/layout.tsx`

- [ ] **Step 1: Replace globals.css with medvolunteer design tokens**

Open `C:/Users/smmcn/Desktop/medvolunteer/web/app/globals.css` and copy the entire file into `app/globals.css`. This includes:
- CSS custom properties for navy (`--color-navy-*`), teal (`--color-teal-*`), status colors
- Shadow definitions (`--shadow-card`, `--shadow-md`, `--shadow-lg`)
- Base typography reset

- [ ] **Step 2: Update app/layout.tsx with Syne + Figtree fonts**

```tsx
// app/layout.tsx
import { Syne, Figtree } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-syne',
})

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-figtree',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${figtree.variable}`}>
      <body className="font-figtree bg-white antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Add cn() utility**

Create `lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Verify fonts load**

```bash
npm run dev
```

Open `http://localhost:3000`. Open DevTools → Network tab. Confirm Syne and Figtree are loaded. No console errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: port design system tokens and fonts from medvolunteer"
```

---

## Task 3: Supabase schema

**Files:**
- Create: `supabase/migrations/20260321000001_initial_schema.sql`
- Create: `supabase/seed.sql`
- Create: `.env.local` (from Supabase dashboard — do not commit)

**Reference schema:** `C:/Users/smmcn/Desktop/medvolunteer/supabase/migrations/20260313221607_initial_schema.sql`

- [ ] **Step 1: Create a new Supabase project**

Go to https://supabase.com/dashboard → New project → name it `volunteerhub`. Save the project URL and anon/service-role keys.

- [ ] **Step 2: Create .env.local**

```bash
# .env.local (never commit this file)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Add `.env.local` to `.gitignore` if not already there.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260321000001_initial_schema.sql`. This is a near-copy of the medvolunteer schema with 4 additions to `organizations`:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type volunteer_category as enum (
  'medical_professional', 'support_staff', 'admin', 'trainee', 'other',
  'dog_foster', 'cat_foster', 'event_handler', 'transport',
  'sorter', 'driver', 'server', 'event_lead',
  'general_volunteer', 'team_lead', 'event_coordinator'
);
create type volunteer_status as enum ('applicant', 'prospect', 'volunteer', 'inactive');
create type pipeline_phase as enum ('intake', 'orientation', 'review', 'training', 'active', 'offboarding');
create type stage_type as enum ('document_sign', 'background_check', 'in_person_meeting', 'learning_module', 'manual_approval', 'form_submission');
create type document_status as enum ('pending', 'signed', 'expired');
create type background_check_result as enum ('clear', 'consider', 'suspended', 'pending');
create type lesson_type as enum ('video', 'text', 'quiz');
create type message_channel as enum ('email', 'sms', 'push');
create type message_recipient_type as enum ('individual', 'group', 'all');
create type check_method as enum ('geofence', 'manual', 'admin');
create type plan_tier as enum ('basic', 'pro', 'enterprise');

-- ============================================================
-- ORGANIZATIONS (SaaS-extended)
-- ============================================================
create table organizations (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  logo_url      text,
  settings      jsonb default '{}',
  -- SaaS additions:
  slug          text unique not null,
  vertical_id   text not null,  -- 'medical' | 'animal_shelter' | 'food_bank' | 'nonprofit'
  plan          plan_tier not null default 'basic',
  plan_status   text default 'active',  -- 'active' | 'past_due' | 'canceled'
  created_at    timestamptz default now()
);

-- ============================================================
-- SUBSCRIPTIONS (Stripe)
-- ============================================================
create table subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  org_id                  uuid references organizations on delete cascade,
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean default false,
  created_at              timestamptz default now()
);

-- ============================================================
-- VERTICAL OVERRIDES (per-org label customization)
-- ============================================================
create table vertical_overrides (
  id                uuid primary key default uuid_generate_v4(),
  org_id            uuid references organizations on delete cascade unique,
  custom_labels     jsonb default '{}',
  custom_categories jsonb default '[]',
  custom_settings   jsonb default '{}',
  updated_at        timestamptz default now()
);

-- ============================================================
-- SUPER ADMINS (platform owner only)
-- ============================================================
create table super_admins (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users on delete cascade unique,
  created_at  timestamptz default now()
);

-- ============================================================
-- LOCATIONS
-- ============================================================
create table locations (
  id                    uuid primary key default uuid_generate_v4(),
  org_id                uuid references organizations on delete cascade,
  name                  text not null,
  address               text,
  lat                   double precision,
  lng                   double precision,
  geofence_radius_meters integer default 200,
  is_active             boolean default true,
  created_at            timestamptz default now()
);

-- ============================================================
-- VOLUNTEERS
-- ============================================================
create table volunteers (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references auth.users on delete set null,
  org_id                uuid references organizations on delete cascade,
  first_name            text not null,
  last_name             text not null,
  email                 text not null,
  phone                 text,
  photo_url             text,
  category              volunteer_category default 'other',
  status                volunteer_status default 'applicant',
  pipeline_phase        pipeline_phase default 'intake',
  notes                 text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  handbook_signed_at    timestamptz,
  checklist_orientation boolean default false,
  checklist_background  boolean default false,
  checklist_training    boolean default false,
  created_at            timestamptz default now()
);

create table volunteer_locations (
  volunteer_id uuid references volunteers on delete cascade,
  location_id  uuid references locations on delete cascade,
  primary key (volunteer_id, location_id)
);

-- ============================================================
-- CREDENTIALS
-- ============================================================
create table credentials (
  id            uuid primary key default uuid_generate_v4(),
  volunteer_id  uuid references volunteers on delete cascade,
  type          text not null,
  license_number text,
  issuing_body  text,
  expiration_date date,
  document_url  text,
  verified_at   timestamptz,
  verified_by   uuid references auth.users,
  created_at    timestamptz default now()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table documents (
  id                   uuid primary key default uuid_generate_v4(),
  volunteer_id         uuid references volunteers on delete cascade,
  name                 text not null,
  type                 text,
  status               document_status default 'pending',
  external_envelope_id text,
  signed_at            timestamptz,
  url                  text,
  is_internal          boolean default false,
  created_at           timestamptz default now()
);

-- ============================================================
-- BACKGROUND CHECKS
-- ============================================================
create table background_checks (
  id            uuid primary key default uuid_generate_v4(),
  volunteer_id  uuid references volunteers on delete cascade,
  provider      text default 'checkr',
  external_id   text,
  status        text default 'pending',
  result        background_check_result,
  report_url    text,
  initiated_at  timestamptz default now(),
  completed_at  timestamptz
);

-- ============================================================
-- ONBOARDING
-- ============================================================
create table onboarding_workflows (
  id                    uuid primary key default uuid_generate_v4(),
  org_id                uuid references organizations on delete cascade,
  name                  text not null,
  applies_to_category   volunteer_category,
  is_active             boolean default true,
  created_at            timestamptz default now()
);

create table onboarding_stages (
  id                        uuid primary key default uuid_generate_v4(),
  workflow_id               uuid references onboarding_workflows on delete cascade,
  name                      text not null,
  description               text,
  order_index               integer not null,
  stage_type                stage_type not null,
  is_required               boolean default true,
  deadline_days_after_start integer,
  metadata                  jsonb default '{}',
  created_at                timestamptz default now()
);

create table onboarding_progress (
  id           uuid primary key default uuid_generate_v4(),
  volunteer_id uuid references volunteers on delete cascade,
  stage_id     uuid references onboarding_stages on delete cascade,
  completed_at timestamptz,
  completed_by uuid references auth.users,
  notes        text,
  metadata     jsonb default '{}'
);

-- ============================================================
-- SHIFTS & TIME TRACKING
-- ============================================================
create table shifts (
  id                uuid primary key default uuid_generate_v4(),
  org_id            uuid references organizations on delete cascade,
  location_id       uuid references locations,
  name              text not null,
  start_time        timestamptz not null,
  end_time          timestamptz not null,
  required_count    integer default 1,
  role_requirements jsonb default '[]',
  notes             text,
  created_at        timestamptz default now()
);

create table shift_assignments (
  id           uuid primary key default uuid_generate_v4(),
  shift_id     uuid references shifts on delete cascade,
  volunteer_id uuid references volunteers on delete cascade,
  role         text,
  status       text default 'assigned',
  created_at   timestamptz default now()
);

create table time_entries (
  id                       uuid primary key default uuid_generate_v4(),
  volunteer_id             uuid references volunteers on delete cascade,
  shift_id                 uuid references shifts,
  location_id              uuid references locations,
  clock_in                 timestamptz not null,
  clock_out                timestamptz,
  duration_minutes_computed integer generated always as (
    extract(epoch from (clock_out - clock_in)) / 60
  ) stored,
  method                   check_method default 'manual',
  created_at               timestamptz default now()
);

-- ============================================================
-- LEARNING MANAGEMENT
-- ============================================================
create table learning_modules (
  id                      uuid primary key default uuid_generate_v4(),
  org_id                  uuid references organizations on delete cascade,
  title                   text not null,
  description             text,
  order_index             integer default 0,
  is_required             boolean default false,
  required_for_categories jsonb default '[]',
  created_at              timestamptz default now()
);

create table lessons (
  id               uuid primary key default uuid_generate_v4(),
  module_id        uuid references learning_modules on delete cascade,
  title            text not null,
  type             lesson_type not null,
  content_url      text,
  duration_minutes integer,
  order_index      integer default 0,
  created_at       timestamptz default now()
);

create table lesson_completions (
  id              uuid primary key default uuid_generate_v4(),
  volunteer_id    uuid references volunteers on delete cascade,
  lesson_id       uuid references lessons on delete cascade,
  completed_at    timestamptz default now(),
  score           integer,
  time_spent_seconds integer
);

create table quiz_questions (
  id                   uuid primary key default uuid_generate_v4(),
  lesson_id            uuid references lessons on delete cascade,
  question             text not null,
  options              jsonb not null,
  correct_answer_index integer not null
);

-- ============================================================
-- COMMUNICATIONS
-- ============================================================
create table messages (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid references organizations on delete cascade,
  sender_id       uuid references auth.users,
  subject         text,
  body            text not null,
  channel         message_channel not null,
  recipient_type  message_recipient_type default 'all',
  sent_at         timestamptz default now(),
  status          text default 'sent'
);

create table message_recipients (
  id           uuid primary key default uuid_generate_v4(),
  message_id   uuid references messages on delete cascade,
  volunteer_id uuid references volunteers on delete cascade,
  delivered_at timestamptz,
  read_at      timestamptz
);

create table push_subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  volunteer_id uuid references volunteers on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz default now()
);

-- ============================================================
-- PIPELINE EXTRAS
-- ============================================================
create table pipeline_tags (
  id           uuid primary key default uuid_generate_v4(),
  volunteer_id uuid references volunteers on delete cascade,
  tag_name     text not null,
  created_at   timestamptz default now()
);

create table flags (
  id           uuid primary key default uuid_generate_v4(),
  volunteer_id uuid references volunteers on delete cascade,
  severity     text,
  title        text not null,
  description  text,
  created_at   timestamptz default now()
);

create table notes (
  id           uuid primary key default uuid_generate_v4(),
  volunteer_id uuid references volunteers on delete cascade,
  content      text not null,
  created_at   timestamptz default now(),
  created_by   uuid references auth.users
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Enable RLS on all tables
alter table organizations enable row level security;
alter table subscriptions enable row level security;
alter table vertical_overrides enable row level security;
alter table super_admins enable row level security;
alter table locations enable row level security;
alter table volunteers enable row level security;
alter table volunteer_locations enable row level security;
alter table credentials enable row level security;
alter table documents enable row level security;
alter table background_checks enable row level security;
alter table onboarding_workflows enable row level security;
alter table onboarding_stages enable row level security;
alter table onboarding_progress enable row level security;
alter table shifts enable row level security;
alter table shift_assignments enable row level security;
alter table time_entries enable row level security;
alter table learning_modules enable row level security;
alter table lessons enable row level security;
alter table lesson_completions enable row level security;
alter table quiz_questions enable row level security;
alter table messages enable row level security;
alter table message_recipients enable row level security;
alter table push_subscriptions enable row level security;
alter table pipeline_tags enable row level security;
alter table flags enable row level security;
alter table notes enable row level security;

-- Helper function: get current user's org_id
create or replace function get_user_org_id()
returns uuid language sql security definer as $$
  select org_id from volunteers where user_id = auth.uid() limit 1;
$$;

-- Volunteers can read their own org's data
create policy "org members can read org data" on organizations
  for select using (id = get_user_org_id());

create policy "org members read locations" on locations
  for select using (org_id = get_user_org_id());

create policy "volunteers read own record" on volunteers
  for select using (user_id = auth.uid() or org_id = get_user_org_id());

-- Service role (admin client) bypasses RLS — all other admin writes go through admin.ts
```

- [ ] **Step 4: Install Supabase CLI and push migration**

```bash
npm install -D supabase
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Expected: Migration runs with no errors. Check Supabase dashboard → Table Editor to confirm tables exist.

- [ ] **Step 5: Write seed data**

Create `supabase/seed.sql`:

```sql
-- Seed two orgs for local dev
insert into organizations (id, name, slug, vertical_id, plan) values
  ('00000000-0000-0000-0000-000000000001', 'Yakima Free Clinic', 'yakima-clinic', 'medical', 'pro'),
  ('00000000-0000-0000-0000-000000000002', 'Happy Paws Rescue', 'happy-paws', 'animal_shelter', 'basic');

-- Seed one location per org
insert into locations (org_id, name, address, lat, lng) values
  ('00000000-0000-0000-0000-000000000001', 'Main Clinic', '102 S 2nd St, Yakima, WA 98901', 46.6021, -120.5059),
  ('00000000-0000-0000-0000-000000000002', 'Main Shelter', '1234 Shelter Rd, Anytown, WA', 47.6062, -122.3321);
```

- [ ] **Step 6: Run seed**

```bash
npx supabase db reset
```

Expected: Tables created and seed data present. Verify in Supabase dashboard.

- [ ] **Step 7: Commit**

```bash
git add supabase/ .env.local.example
git commit -m "feat: add Supabase schema with SaaS extensions and seed data"
```

---

## Task 4: Supabase client helpers

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`
- Create: `types/database.ts`

**Reference:** `C:/Users/smmcn/Desktop/medvolunteer/web/lib/supabase/` — copy these files directly. They are boilerplate that won't change.

- [ ] **Step 1: Copy Supabase helpers from medvolunteer**

```bash
mkdir -p lib/supabase
cp C:/Users/smmcn/Desktop/medvolunteer/web/lib/supabase/client.ts lib/supabase/client.ts
cp C:/Users/smmcn/Desktop/medvolunteer/web/lib/supabase/server.ts lib/supabase/server.ts
cp C:/Users/smmcn/Desktop/medvolunteer/web/lib/supabase/admin.ts lib/supabase/admin.ts
```

Update the import paths if needed (change any `@/lib/` references to match the new structure).

- [ ] **Step 2: Generate TypeScript types**

```bash
npx supabase gen types typescript --project-id your-project-ref > types/database.ts
```

Expected: `types/database.ts` created with all table types.

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/ types/
git commit -m "feat: add Supabase client helpers and generated types"
```

---

## Task 5: Vertical config system (TDD)

**Files:**
- Create: `verticals/types.ts`
- Create: `verticals/index.ts`
- Create: `verticals/medical.ts`
- Create: `verticals/animal-shelter.ts`
- Create: `verticals/food-bank.ts`
- Create: `verticals/nonprofit.ts`
- Create: `vitest.config.ts`
- Create: `vitest/__tests__/verticals.test.ts`

- [ ] **Step 1: Create vitest.config.ts**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write failing tests for getVerticalConfig and mergeLabels**

Create `vitest/__tests__/verticals.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getVerticalConfig, mergeLabels, VERTICALS } from '@/verticals/index'

describe('getVerticalConfig', () => {
  it('returns medical config for "medical"', () => {
    const config = getVerticalConfig('medical')
    expect(config.id).toBe('medical')
    expect(config.labels.shift).toBeDefined()
    expect(config.volunteerCategories.length).toBeGreaterThan(0)
  })

  it('returns animal_shelter config', () => {
    const config = getVerticalConfig('animal_shelter')
    expect(config.id).toBe('animal_shelter')
  })

  it('returns food_bank config', () => {
    const config = getVerticalConfig('food_bank')
    expect(config.id).toBe('food_bank')
  })

  it('returns nonprofit config', () => {
    const config = getVerticalConfig('nonprofit')
    expect(config.id).toBe('nonprofit')
  })

  it('throws for unknown vertical', () => {
    expect(() => getVerticalConfig('unknown' as any)).toThrow()
  })
})

describe('mergeLabels', () => {
  it('returns vertical defaults when no overrides', () => {
    const config = getVerticalConfig('medical')
    const labels = mergeLabels(config.labels, {})
    expect(labels).toEqual(config.labels)
  })

  it('applies org overrides on top of vertical defaults', () => {
    const config = getVerticalConfig('food_bank')
    const overrides = { shift: 'Pantry Slot' }
    const labels = mergeLabels(config.labels, overrides)
    expect(labels.shift).toBe('Pantry Slot')
    // other labels unchanged
    expect(labels.volunteer).toBe(config.labels.volunteer)
  })

  it('ignores unknown override keys', () => {
    const config = getVerticalConfig('nonprofit')
    const overrides = { unknownKey: 'value' }
    const labels = mergeLabels(config.labels, overrides as any)
    expect(labels).toEqual(config.labels)
  })
})

describe('VERTICALS registry', () => {
  it('contains exactly 4 verticals', () => {
    expect(Object.keys(VERTICALS)).toHaveLength(4)
  })

  it('every vertical has required label keys', () => {
    const requiredKeys = ['volunteer', 'volunteers', 'shift', 'shifts', 'credential', 'location', 'category']
    for (const vertical of Object.values(VERTICALS)) {
      for (const key of requiredKeys) {
        expect(vertical.labels).toHaveProperty(key)
      }
    }
  })
})
```

- [ ] **Step 4: Run tests to confirm they fail**

```bash
npm test
```

Expected: All tests fail with "Cannot find module '@/verticals/index'".

- [ ] **Step 5: Create verticals/types.ts**

```ts
// verticals/types.ts

export interface OrgLabels {
  volunteer: string    // singular: "Volunteer" | "Foster" | "Helper" | "Clinician"
  volunteers: string   // plural
  shift: string        // "Shift" | "Foster Assignment" | "Distribution Slot" | "Event"
  shifts: string
  credential: string   // "License" | "Training Certificate" | "Food Handler Cert"
  location: string     // "Location" | "Shelter" | "Pantry"
  category: string     // "Role" | "Type"
}

export interface OnboardingStageTemplate {
  name: string
  stage_type: 'document_sign' | 'background_check' | 'in_person_meeting' | 'learning_module' | 'manual_approval' | 'form_submission'
  is_required: boolean
  order_index: number
}

export interface LearningModuleTemplate {
  title: string
  description: string
  is_required: boolean
}

export interface VerticalConfig {
  id: 'medical' | 'animal_shelter' | 'food_bank' | 'nonprofit'
  name: string
  icon: string
  labels: OrgLabels
  volunteerCategories: string[]
  defaultOnboardingStages: OnboardingStageTemplate[]
  defaultLearningModuleTemplates: LearningModuleTemplate[]
}
```

- [ ] **Step 6: Create the four vertical configs**

Create `verticals/medical.ts`:

```ts
import type { VerticalConfig } from './types'

export const medicalVertical: VerticalConfig = {
  id: 'medical',
  name: 'Medical / Clinic',
  icon: '🏥',
  labels: {
    volunteer: 'Clinician',
    volunteers: 'Clinicians',
    shift: 'Clinic Session',
    shifts: 'Clinic Sessions',
    credential: 'License',
    location: 'Clinic Location',
    category: 'Role',
  },
  volunteerCategories: ['medical_professional', 'support_staff', 'admin', 'trainee', 'other'],
  defaultOnboardingStages: [
    { name: 'Application Review', stage_type: 'manual_approval', is_required: true, order_index: 0 },
    { name: 'Background Check', stage_type: 'background_check', is_required: true, order_index: 1 },
    { name: 'Orientation Meeting', stage_type: 'in_person_meeting', is_required: true, order_index: 2 },
    { name: 'Sign Handbook', stage_type: 'document_sign', is_required: true, order_index: 3 },
    { name: 'Complete Training Modules', stage_type: 'learning_module', is_required: true, order_index: 4 },
  ],
  defaultLearningModuleTemplates: [
    { title: 'Clinic Orientation', description: 'Introduction to clinic policies and procedures', is_required: true },
    { title: 'HIPAA Compliance', description: 'Patient privacy and data handling', is_required: true },
  ],
}
```

Create `verticals/animal-shelter.ts`:

```ts
import type { VerticalConfig } from './types'

export const animalShelterVertical: VerticalConfig = {
  id: 'animal_shelter',
  name: 'Animal Shelter & Rescue',
  icon: '🐾',
  labels: {
    volunteer: 'Foster / Volunteer',
    volunteers: 'Fosters & Volunteers',
    shift: 'Foster Assignment',
    shifts: 'Foster Assignments',
    credential: 'Training Certificate',
    location: 'Shelter Location',
    category: 'Type',
  },
  volunteerCategories: ['dog_foster', 'cat_foster', 'event_handler', 'transport', 'admin'],
  defaultOnboardingStages: [
    { name: 'Application Review', stage_type: 'manual_approval', is_required: true, order_index: 0 },
    { name: 'Orientation', stage_type: 'in_person_meeting', is_required: true, order_index: 1 },
    { name: 'Sign Foster Agreement', stage_type: 'document_sign', is_required: true, order_index: 2 },
    { name: 'Complete Animal Handling Training', stage_type: 'learning_module', is_required: true, order_index: 3 },
  ],
  defaultLearningModuleTemplates: [
    { title: 'Animal Handling Basics', description: 'Safe handling of dogs and cats', is_required: true },
    { title: 'Foster Home Preparation', description: 'Setting up a safe foster environment', is_required: true },
  ],
}
```

Create `verticals/food-bank.ts`:

```ts
import type { VerticalConfig } from './types'

export const foodBankVertical: VerticalConfig = {
  id: 'food_bank',
  name: 'Food Bank & Pantry',
  icon: '🥫',
  labels: {
    volunteer: 'Helper',
    volunteers: 'Helpers',
    shift: 'Distribution Slot',
    shifts: 'Distribution Slots',
    credential: 'Food Handler Cert',
    location: 'Pantry Location',
    category: 'Role',
  },
  volunteerCategories: ['sorter', 'driver', 'server', 'event_lead', 'admin'],
  defaultOnboardingStages: [
    { name: 'Registration', stage_type: 'form_submission', is_required: true, order_index: 0 },
    { name: 'Orientation', stage_type: 'in_person_meeting', is_required: true, order_index: 1 },
    { name: 'Sign Volunteer Agreement', stage_type: 'document_sign', is_required: true, order_index: 2 },
  ],
  defaultLearningModuleTemplates: [
    { title: 'Food Safety Basics', description: 'Safe food handling and distribution', is_required: true },
    { title: 'Pantry Operations', description: 'How distribution days work', is_required: false },
  ],
}
```

Create `verticals/nonprofit.ts`:

```ts
import type { VerticalConfig } from './types'

export const nonprofitVertical: VerticalConfig = {
  id: 'nonprofit',
  name: 'General Non-Profit',
  icon: '🤝',
  labels: {
    volunteer: 'Volunteer',
    volunteers: 'Volunteers',
    shift: 'Event',
    shifts: 'Events',
    credential: 'Certificate',
    location: 'Location',
    category: 'Role',
  },
  volunteerCategories: ['general_volunteer', 'team_lead', 'event_coordinator', 'admin'],
  defaultOnboardingStages: [
    { name: 'Application', stage_type: 'form_submission', is_required: true, order_index: 0 },
    { name: 'Orientation', stage_type: 'in_person_meeting', is_required: false, order_index: 1 },
    { name: 'Sign Volunteer Agreement', stage_type: 'document_sign', is_required: true, order_index: 2 },
  ],
  defaultLearningModuleTemplates: [
    { title: 'Volunteer Orientation', description: 'Welcome to the organization', is_required: true },
  ],
}
```

- [ ] **Step 7: Create verticals/index.ts**

```ts
// verticals/index.ts
import type { OrgLabels, VerticalConfig } from './types'
import { medicalVertical } from './medical'
import { animalShelterVertical } from './animal-shelter'
import { foodBankVertical } from './food-bank'
import { nonprofitVertical } from './nonprofit'

export type VerticalId = VerticalConfig['id']

export const VERTICALS: Record<VerticalId, VerticalConfig> = {
  medical: medicalVertical,
  animal_shelter: animalShelterVertical,
  food_bank: foodBankVertical,
  nonprofit: nonprofitVertical,
}

export function getVerticalConfig(id: VerticalId): VerticalConfig {
  const vertical = VERTICALS[id]
  if (!vertical) throw new Error(`Unknown vertical: ${id}`)
  return vertical
}

export function mergeLabels(
  verticalLabels: OrgLabels,
  overrides: Partial<Record<string, string>>
): OrgLabels {
  const validKeys = Object.keys(verticalLabels) as Array<keyof OrgLabels>
  const result = { ...verticalLabels }
  for (const key of validKeys) {
    if (overrides[key] !== undefined) {
      result[key] = overrides[key] as string
    }
  }
  return result
}

export type { VerticalConfig, OrgLabels } from './types'
```

- [ ] **Step 8: Run tests and verify they pass**

```bash
npm test
```

Expected: All 9 tests PASS. If any fail, fix the implementation — do not change the tests.

- [ ] **Step 9: Commit**

```bash
git add verticals/ vitest/ vitest.config.ts package.json
git commit -m "feat: vertical config system with getVerticalConfig and mergeLabels (all tests passing)"
```

---

## Task 6: OrgProvider context

**Files:**
- Create: `contexts/org-context.tsx`
- Create: `lib/org.ts`

- [ ] **Step 1: Create lib/org.ts — server-side org fetcher**

```ts
// lib/org.ts
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'

export type OrgRow = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  vertical_id: string
  plan: 'basic' | 'pro' | 'enterprise'
  plan_status: string
  settings: Record<string, unknown>
}

export type OrgOverrides = {
  custom_labels: Record<string, string>
  custom_categories: string[]
  custom_settings: Record<string, unknown>
}

export async function getOrgBySlug(slug: string): Promise<{ org: OrgRow; overrides: OrgOverrides }> {
  // Use the admin client for org lookup — org records are public by slug (needed before
  // any user is authenticated). The admin client bypasses RLS. Sensitive per-user data
  // (volunteers, credentials, etc.) must always use the user-scoped server client.
  const supabase = createAdminSupabaseClient()

  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, slug, logo_url, vertical_id, plan, plan_status, settings')
    .eq('slug', slug)
    .single()

  if (error || !org) notFound()

  const { data: overridesRow } = await supabase
    .from('vertical_overrides')
    .select('custom_labels, custom_categories, custom_settings')
    .eq('org_id', org.id)
    .single()

  const overrides: OrgOverrides = overridesRow ?? {
    custom_labels: {},
    custom_categories: [],
    custom_settings: {},
  }

  return { org, overrides }
}
```

- [ ] **Step 2: Create contexts/org-context.tsx**

```tsx
// contexts/org-context.tsx
'use client'

import { createContext, useContext } from 'react'
import type { OrgLabels, VerticalConfig } from '@/verticals/types'

export type OrgContextValue = {
  org: {
    id: string
    name: string
    slug: string
    logo_url: string | null
    vertical_id: string
    plan: 'basic' | 'pro' | 'enterprise'
    plan_status: string
  }
  vertical: VerticalConfig
  labels: OrgLabels
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: OrgContextValue
}) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside OrgProvider')
  return ctx
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/org.ts contexts/org-context.tsx
git commit -m "feat: OrgProvider context and getOrgBySlug server helper"
```

---

## Task 7: Path routing and layout wiring

**Files:**
- Create: `app/[orgSlug]/layout.tsx`
- Create: `app/[orgSlug]/dashboard/page.tsx`
- Create: `app/[orgSlug]/not-found.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create app/[orgSlug]/layout.tsx**

```tsx
// app/[orgSlug]/layout.tsx
import { getOrgBySlug } from '@/lib/org'
import { getVerticalConfig, mergeLabels } from '@/verticals/index'
import { OrgProvider } from '@/contexts/org-context'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { org, overrides } = await getOrgBySlug(orgSlug)
  const vertical = getVerticalConfig(org.vertical_id as any)
  const labels = mergeLabels(vertical.labels, overrides.custom_labels)

  return (
    <OrgProvider value={{ org, vertical, labels }}>
      {children}
    </OrgProvider>
  )
}
```

- [ ] **Step 2: Create app/[orgSlug]/not-found.tsx**

```tsx
// app/[orgSlug]/not-found.tsx
export default function OrgNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Organization not found</h1>
        <p className="text-slate-400">The organization you're looking for doesn't exist or may have moved.</p>
        <a href="/" className="mt-4 inline-block text-[#00ACC1] hover:underline">← Back to VolunteerHub</a>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create placeholder dashboard page**

`app/[orgSlug]/dashboard/page.tsx` is a Server Component, so `useOrg()` (a client hook) can't be called there directly. Create a thin `'use client'` component for the debug display, and import it from the page.

Create `app/[orgSlug]/dashboard/_debug-panel.tsx`:

```tsx
'use client'
import { useOrg } from '@/contexts/org-context'

export function DebugPanel() {
  const { org, vertical, labels } = useOrg()
  return (
    <div className="p-8 bg-[#0f172a] min-h-screen text-white font-mono text-sm">
      <h1 className="text-2xl font-bold mb-6 text-[#00ACC1]">
        {org.name} — Dashboard (Phase 1 Placeholder)
      </h1>
      <div className="mb-4">
        <div className="text-slate-400 mb-1">Org slug</div>
        <div>{org.slug}</div>
      </div>
      <div className="mb-4">
        <div className="text-slate-400 mb-1">Vertical</div>
        <div>{vertical.icon} {vertical.name}</div>
      </div>
      <div className="mb-4">
        <div className="text-slate-400 mb-1">Plan</div>
        <div>{org.plan}</div>
      </div>
      <div className="mb-4">
        <div className="text-slate-400 mb-1">Labels</div>
        <pre className="bg-slate-800 p-3 rounded">{JSON.stringify(labels, null, 2)}</pre>
      </div>
    </div>
  )
}
```

Then `app/[orgSlug]/dashboard/page.tsx`:

```tsx
// app/[orgSlug]/dashboard/page.tsx
import { DebugPanel } from './_debug-panel'

export default function DashboardPage() {
  return <DebugPanel />
}
```

- [ ] **Step 4: Update homepage placeholder**

```tsx
// app/page.tsx
export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-syne)' }}>
          VolunteerHub
        </h1>
        <p className="text-slate-400">Multi-industry volunteer management platform. Coming soon.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run dev server and test end-to-end**

```bash
npm run dev
```

Open `http://localhost:3000/yakima-clinic/dashboard` (seed org).

Expected: Debug panel shows:
- Org name: "Yakima Free Clinic"
- Vertical: 🏥 Medical / Clinic
- Plan: pro
- Labels: `{ volunteer: "Clinician", shift: "Clinic Session", ... }`

Then open `http://localhost:3000/happy-paws/dashboard`.

Expected: Debug panel shows:
- Org name: "Happy Paws Rescue"
- Vertical: 🐾 Animal Shelter & Rescue
- Labels: `{ volunteer: "Foster / Volunteer", shift: "Foster Assignment", ... }`

Open `http://localhost:3000/nonexistent-slug/dashboard`.

Expected: Custom not-found page renders.

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat: path-based org routing with OrgProvider, labels resolve per vertical"
```

---

## Task 8: TypeScript check and final verification

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: Zero errors. Fix any type errors before proceeding.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All 9 vertical tests PASS.

- [ ] **Step 3: Final manual verification checklist**

- [ ] `http://localhost:3000` — homepage renders, no console errors
- [ ] `http://localhost:3000/yakima-clinic/dashboard` — shows medical vertical labels
- [ ] `http://localhost:3000/happy-paws/dashboard` — shows animal shelter labels
- [ ] `http://localhost:3000/bad-slug/dashboard` — shows org not-found page
- [ ] DevTools → Network — Syne and Figtree fonts loaded
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] All unit tests pass (`npm test`)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 Foundation complete — multi-tenant routing, vertical configs, OrgProvider"
```

---

## Phase 1 Complete

**What's working after this phase:**
- New `volunteerhub/` repo with Next.js 15 + Supabase + Vitest
- Full schema deployed to Supabase with two seed orgs
- Vertical config system (`getVerticalConfig`, `mergeLabels`) fully tested
- Path-based multi-tenancy: any org slug resolves its org, vertical, and labels
- `OrgProvider` injects org context into the entire `[orgSlug]` subtree
- Two orgs (medical, animal shelter) render different labels on the same dashboard URL pattern

**Next:** Phase 2 — Signup + Billing (`docs/superpowers/plans/2026-03-21-volunteerhub-phase-2-signup-billing.md`)
