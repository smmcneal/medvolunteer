# CLAUDE.md — MedVolunteer Codebase Guide

This document provides a comprehensive reference for AI assistants working in this repository.

---

## Project Overview

**MedVolunteer** is a full-stack web application for managing medical volunteers. It consists of:

- **Volunteer PWA** — Mobile-first installable web app with 5 tabs (Home, Shifts, Handbook, Profile, Messages)
- **Admin Dashboard** — 8-section staff interface (Volunteers, Onboarding, Shifts, Learning, Reports, Messages, Settings)
- **Supabase Backend** — PostgreSQL database, Row-Level Security, Auth, and 7 Deno Edge Functions

Current development status: **Phase 8.5 complete** (Public Pages & Entry Points). Phases 9–10 (deployment prep) are pending.

---

## Repository Structure

```
medvolunteer/
├── web/                        # Next.js 14 full-stack application
│   ├── app/                    # App Router (pages, layouts, API routes)
│   │   ├── (public)/           # Marketing homepage + volunteer landing
│   │   ├── dashboard/          # Admin dashboard (protected)
│   │   ├── volunteer/(tabs)/   # Volunteer PWA shell (protected)
│   │   ├── api/                # Next.js API routes
│   │   └── auth/callback/      # OAuth callback
│   ├── components/             # Shared React components (e.g. Sidebar.tsx)
│   ├── lib/supabase/           # Supabase client factories (server, client, admin)
│   ├── lib/utils.ts            # cn() utility (clsx + tailwind-merge)
│   ├── types/database.ts       # Auto-generated Supabase type definitions
│   ├── public/                 # Static assets (manifest.json, sw.js, icons)
│   ├── middleware.ts            # Auth guards + routing
│   ├── next.config.ts          # Next.js config (minimal)
│   ├── tsconfig.json           # TypeScript config
│   ├── eslint.config.mjs       # ESLint v9 flat config
│   └── postcss.config.mjs      # Tailwind v4 PostCSS
│
├── supabase/
│   ├── migrations/             # PostgreSQL schema migrations (7 files)
│   ├── functions/              # Deno edge functions (7 total)
│   ├── seed.sql                # Local development test data
│   └── config.toml             # Supabase CLI local config
│
└── MedVolunteer-roadmap.txt    # Full project specification (564 lines)
```

---

## Development Commands

All commands run from `web/`:

```bash
cd web
npm run dev        # Start dev server at localhost:3000
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint
```

### Supabase Local Development

```bash
supabase start          # Start local Supabase (Docker required)
supabase db reset       # Reset DB and re-run all migrations + seed.sql
supabase functions serve # Run edge functions locally
supabase stop           # Stop local stack
```

Local ports: DB 54322, API 54321, Studio 54323.

---

## Environment Variables

Required in `web/.env.local` (never committed):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # Server-only — never expose to browser
NEXT_PUBLIC_VAPID_PUBLIC_KEY=    # Web Push public key
```

Edge functions read their own env vars from Supabase secrets (set via `supabase secrets set`).

---

## Authentication & Authorization

### Three Supabase Clients

| File | Usage | Scope |
|------|-------|-------|
| `lib/supabase/server.ts` | Server Components, Server Actions | Respects RLS |
| `lib/supabase/client.ts` | Client Components (browser only) | Respects RLS |
| `lib/supabase/admin.ts` | Server-only operations requiring RLS bypass | Full access via `SERVICE_ROLE_KEY` |

**Rule:** Never import `admin.ts` in client components or expose `SERVICE_ROLE_KEY` to the browser.

### Middleware Auth Guards (`middleware.ts`)

- `/dashboard/*` — requires auth → redirects to `/login`
- `/volunteer/*` (except `/volunteer/login`) — requires auth → redirects to `/volunteer/login`
- `/apply`, `/icons/*`, `/manifest.json`, `/sw.js` — always public
- Matcher excludes `_next/static` and `_next/image`

### Volunteer Identity Resolution

Server components look up the volunteer record by matching `auth.users.id` to `volunteers.user_id`. Use the admin client when RLS would otherwise block the lookup.

---

## Database

### Key Enums

| Enum | Values |
|------|--------|
| `volunteer_status` | `applicant` → `prospect` → `volunteer` → `inactive` |
| `pipeline_phase` | `intake` → `orientation` → `review` → `training` → `active` → `offboarding` |
| `volunteer_category` | `medical_professional`, `support_staff`, `admin`, `trainee`, `other` |
| `stage_type` | `document_sign`, `background_check`, `in_person_meeting`, `learning_module`, `manual_approval`, `form_submission` |
| `message_channel` | `email`, `sms`, `push` |
| `background_check_result` | `clear`, `consider`, `suspended`, `pending` |
| `flag_severity` | `info`, `warning`, `critical` |
| `document_status` | `pending`, `signed`, `expired` |

### Schema Conventions

- All primary keys are UUIDs (`uuid DEFAULT gen_random_uuid()`)
- Timestamps use `timestamptz` (UTC)
- Soft relationships: `volunteer_id` FKs reference `volunteers.id`
- Many-to-many: `volunteer_tags`, `volunteer_flags` junction tables
- Checklist state stored as boolean columns directly on `volunteers` (e.g. `checklist_bg_form_signed`)

### Migrations

Migrations live in `supabase/migrations/` and run in filename order. Always create new migration files — never modify existing ones. Seed data is in `supabase/seed.sql` and also in `20260313221902_seed_data.sql` (applied automatically on `db reset`).

**Local test accounts** (from seed):
- `admin@medvolunteer.org` / `admin123` — Admin
- `alice@example.com` / `volunteer123` — Medical Professional, Active
- `ben@example.com` / `volunteer123` — Medical Professional, Active
- `cora@example.com` / `volunteer123` — Support Staff, Prospect

---

## TypeScript Conventions

- **Strict mode** is enabled — no implicit `any`
- **Path alias:** `@/*` maps to `web/*` (e.g. `@/lib/utils`, `@/components/Sidebar`)
- **Type source of truth:** `web/types/database.ts` — generated from Supabase schema via `supabase gen types typescript`
- Regenerate after schema changes: `supabase gen types typescript --local > web/types/database.ts`

---

## Rendering & Data Fetching Patterns

### Server vs. Client Components

```
Server Component (default)   → data fetching, auth checks, passes props down
'use client'                 → interactive UI, hooks, browser APIs, PWA shell
'use server' (Server Action) → form mutations, clock-in/out, revalidation
```

### Data Fetching

- **Parallel queries** — Always use `Promise.all()` for independent fetches in server components
- **Server Actions** — Call `revalidatePath()` after mutations to refresh server component data
- **No SWR/React Query** — Data fetching is server-first; client components use the browser Supabase client directly when needed

### Performance

- Page loading states: each volunteer tab has a `loading.tsx` skeleton
- Error boundaries: each volunteer tab group has an `error.tsx` with a reset button
- Dashboard root uses `export const dynamic = 'force-dynamic'` to disable caching for live KPI data

---

## Styling

- **Tailwind CSS v4** via `@tailwindcss/postcss` — utility-first, no `tailwind.config.js`
- **CSS variables** defined in `globals.css`: `--navy` (#1B2A4A), `--teal` (#00897B), `--amber`, `--danger`
- **`cn()` utility** (`lib/utils.ts`) — use for conditional/merged Tailwind classes: `cn("base-class", condition && "conditional-class")`
- **Radix UI** — used for accessible primitives (Dialog, Dropdown, Select, Tabs, Avatar)
- **Lucide React** — icon library; always import named icons (`import { IconName } from "lucide-react"`)
- Inline style objects are acceptable for dynamic or one-off values; Tailwind classes preferred otherwise

---

## PWA Architecture

The volunteer app is a fully installable PWA:

- **Manifest:** `public/manifest.json` — scope `/volunteer/`, start URL `/volunteer/home`
- **Service Worker:** `public/sw.js` — cache-first for static assets, network-first for navigation, offline fallback at `/volunteer/offline`
- **Install prompt:** handled in `VolunteerShell.tsx` (`beforeinstallprompt` for Android/Chrome; manual instructions shown on iOS Safari)
- **Push notifications:** VAPID-signed Web Push via `send-push` edge function; subscriptions stored in `push_subscriptions` table; registered via `POST /api/push-subscription`
- **Safe area:** bottom tab bar uses `env(safe-area-inset-bottom)` for notch/home bar

---

## Edge Functions

All 7 functions live in `supabase/functions/` and run on Deno v2. They require a valid Supabase JWT unless otherwise noted.

| Function | Trigger | Key Logic |
|----------|---------|-----------|
| `clock-in` | POST | Creates `time_entries` row; prevents duplicate clock-in for same shift |
| `clock-out` | POST | Closes `time_entries`, calculates `duration_minutes` |
| `send-message` | POST | Routes to Resend (email), Twilio (SMS), or `send-push` |
| `send-push` | POST | VAPID + AES-128-GCM Web Push (RFC 8291); removes expired subscriptions |
| `initiate-background-check` | POST | Calls Checkr API to create candidate + report |
| `background-check-webhook` | Webhook | Updates `background_checks` status/result from Checkr |
| `advance-onboarding` | POST | Marks stage complete; transitions volunteer to `active`; sends welcome notification |

Edge function conventions:
- All functions return JSON with a CORS `Access-Control-Allow-Origin: *` header
- Handle `OPTIONS` preflight requests
- Use `Deno.env.get()` for secrets

---

## Admin Dashboard Routes

| Route | Purpose |
|-------|---------|
| `/dashboard` | KPI overview (active volunteers, hours, open shifts) |
| `/dashboard/volunteers` | Volunteer pipeline table with tags/flags |
| `/dashboard/volunteers/[id]` | Volunteer detail (profile, onboarding, notes, uploads) |
| `/dashboard/onboarding` | Onboarding stage management |
| `/dashboard/shifts` | Shift scheduling |
| `/dashboard/learning` | Learning module management |
| `/dashboard/reports` | Hours/attendance reports with Recharts |
| `/dashboard/messages` | Messaging center |
| `/dashboard/settings` | Org settings |

---

## Volunteer PWA Routes

| Route | Purpose |
|-------|---------|
| `/volunteer/home` | Dashboard (upcoming shifts, checklist, expiring creds) |
| `/volunteer/shifts` | Clock in/out, shift history |
| `/volunteer/handbook` | Volunteer handbook (sign + checklist) |
| `/volunteer/profile` | Editable contact info, documents, credentials |
| `/volunteer/messages` | Message inbox |
| `/volunteer/login` | Auth page |
| `/volunteer/offline` | Offline fallback page |

---

## Component Conventions

- **`Sidebar.tsx`** — Client component; active state via `usePathname()`; sign-out via browser Supabase client
- **`VolunteerShell.tsx`** — Client component; PWA install logic; bottom tab navigation
- View components (e.g. `HomeView`, `ShiftsView`) separate display logic from server page data fetching
- Prefer composition over configuration — build focused components rather than highly-configurable ones

---

## Third-Party Integrations

| Service | Purpose | Env Key |
|---------|---------|---------|
| Supabase | DB, Auth, Storage, Edge Functions | `SUPABASE_*` |
| Checkr | Background checks | Set in Supabase secrets |
| Dropbox Sign | Document e-signing | Set in Supabase secrets |
| Resend | Transactional email | Set in Supabase secrets |
| Twilio | SMS messaging | Set in Supabase secrets |
| Mux | Video hosting (Learning modules) | Set in Supabase secrets |
| VAPID | Web Push signing | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + secret |

---

## Key Conventions & Rules

1. **Never modify existing migrations.** Create a new migration file for schema changes.
2. **Never expose `SUPABASE_SERVICE_ROLE_KEY`** in client-side code or responses.
3. **Use `createAdminClient()`** only in server-side code (Server Components, Server Actions, API routes) when RLS would incorrectly block a legitimate operation.
4. **Use `cn()`** from `lib/utils.ts` for all conditional Tailwind class merging.
5. **Regenerate types** after schema changes: `supabase gen types typescript --local > web/types/database.ts`
6. **Parallel data fetching** — wrap independent `await` calls in `Promise.all()`.
7. **Server Actions for mutations** — use `'use server'` + `revalidatePath()` pattern.
8. **No test framework currently configured** — manual testing with seed accounts; test locally with `supabase db reset`.
9. **Tailwind v4** — no `tailwind.config.js`; configure via CSS variables and PostCSS only.
10. **Import path alias** — always use `@/` prefix for imports within `web/` (e.g. `@/lib/utils`).
