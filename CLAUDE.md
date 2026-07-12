# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A volunteer management platform for medical clinics — admin dashboard (`/dashboard`) + volunteer PWA (`/volunteer`), built on Next.js 14 and Supabase.

## Commands

All commands run from `web/`:

```bash
npm run dev       # Start Next.js dev server (port 3000)
npm run build     # Production build
npm run lint      # ESLint (bare eslint, not next lint)
```

There is no test suite in this project.

Supabase (run from repo root, requires Docker):
```bash
npx supabase start         # Start local Supabase stack (port 54321)
npx supabase db reset      # Reset DB and re-run all migrations + seed.sql
npx supabase migration new <name>   # Create new migration file
npx supabase gen types typescript --local > web/types/database.ts  # Regenerate DB types after schema changes
```

Dev auto-login (development only):
```
GET http://localhost:3000/api/dev/login?role=admin&redirect=/dashboard/shifts
GET http://localhost:3000/api/dev/login?role=volunteer&redirect=/volunteer/home
```
Credentials are in `web/.env.local` (`DEV_ADMIN_EMAIL` etc.). Blocked with 403 in production.

## Environment Variables

Copy `web/.env.example` → `web/.env.local` for local dev. Key split:

> ⚠️ **`NEXT_PUBLIC_*` vars are inlined at BUILD time.** Changing one in Vercel does nothing to an existing deployment — it only takes effect on the next build. This caused a production login outage on 2026-07-11 (vars saved ~10h after the last build). **After any `NEXT_PUBLIC_*` change, redeploy.**
>
> To verify what a deployment *actually* got — as opposed to what the dashboard claims — decode the deployed JS bundle. Vercel masks "Sensitive" values so you cannot read a field back; the bundle is the only ground truth.

| Var | Where | Purpose |
|-----|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | `.env.local` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Admin client (bypasses RLS) |
| `NEXT_PUBLIC_SITE_URL` | `.env.local` + Vercel | **Volunteer invite links only** (`dashboard/volunteers/actions.ts`). Falls back to `http://localhost:3000` — if unset in production, every invite email contains a dead localhost link and the admin still sees "invite sent". Must be the real domain, and needs a redeploy to take effect. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `.env.local` + Vercel | Web push subscription; push silently doesn't work without it |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | `.env.local` | Email sending |
| `NOTION_TOKEN` / `NOTION_DEV_TASKS_DB_ID` | `.env.local` + GitHub Secrets | Notion automation |
| `NOTION_FEATURE_REQUESTS_DB_ID` | GitHub Secrets only | Auto-build CI reads triaged features from this DB |
| `ANTHROPIC_API_KEY` | GitHub Secrets only | Auto-build CI invokes Claude Code to implement features |
| `VERCEL_WEBHOOK_SECRET` | `.env.local` | Webhook signature verification |
| `CRON_SECRET` | Vercel env + `.env.local` | Protects `/api/cron/*` routes |
| `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_ID` | GitHub Secrets only | CI migration runner |

Local Notion automation is a no-op if `NOTION_TOKEN` is not set — it silently skips.

## Architecture

### Repo Layout

```
web/          Next.js 14 app (admin + volunteer UI)
supabase/     Migrations, seed data, edge functions
scripts/      notion-sync.cjs — Notion API helper used by hooks/CI
              build-heather-guide.cjs — generates Heather_Notion_Setup_Guide.docx
.github/      supabase-migrate.yml — auto-applies migrations on merge to main (push paths filter: supabase/migrations/**; single migrate job, concurrency-guarded)
              notion-pr-sync.yml — PR events → Notion Dev Tasks status
              auto-build-features.yml — nightly (3am UTC) Claude Code agent that reads "Ready" tasks from Notion Feature Requests DB and opens PRs. Skips if bug backlog is not clear. Branch names follow feat/DEV-###-slug. Requires ANTHROPIC_API_KEY, NOTION_FEATURE_REQUESTS_DB_ID, GH_PAT secrets.
```

### Route Structure

Three distinct user zones, each protected by its own layout:

| Zone | Root | Layout guard |
|------|------|-------------|
| Admin | `/dashboard` | `web/app/dashboard/layout.tsx` → `getAdminUser()`; not logged in → `/login`, logged in but not admin → `/volunteer/home` |
| Volunteer PWA | `/volunteer/(tabs)` | `web/app/volunteer/layout.tsx` → redirect to `/volunteer/login` |
| Public | `/apply`, `/auth/callback`, `/login` | None |

No `middleware.ts` — page access is enforced via **server-side layout checks**. But layout guards do NOT protect server actions (they're independently invokable POST endpoints), which is why every action carries its own guard (below).

### Auth Guards (web/lib/auth.ts)

Admin = membership in the `admin_users` table (explicit role, service-role-only RLS).

| Helper | Behavior | Use in |
|--------|----------|--------|
| `requireAdmin()` | throws unless caller is an admin; returns the auth user | **every** dashboard server action, first line |
| `getAdminUser()` | returns user or null (redirect-friendly) | layouts |
| `requireVolunteer()` | throws unless caller has a volunteers row; returns `{ user, volunteerId }` | **every** volunteer server action |

**Non-negotiable**: a server action without one of these guards is a publicly invokable endpoint. Never rely on the page being "behind the layout".

### Supabase Client Rules

Three clients:

| Client | File | When to use |
|--------|------|-------------|
| `createAdminClient()` | `web/lib/supabase/admin.ts` | All database reads/writes in server code, after an auth guard |
| `createClient()` | `web/lib/supabase/server.ts` | Auth only — `getUser()`, cookie/session handling |
| `createBrowserClient()` | `web/lib/supabase/client.ts` | Client components, auth only (`signOut`, `signInWithPassword`) |

**RLS is deny-by-default on every table** (no anon/authenticated policies). Querying tables with `createClient()` or the browser client returns empty results — all data access goes through `createAdminClient()` after `requireAdmin()`/`requireVolunteer()`. Volunteer-facing actions must scope queries by the caller's `volunteerId` and verify ownership before writes.

### Server Actions Pattern

Every `actions.ts` is `'use server'`. The standard shape:

```ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'   // or requireVolunteer
import { revalidatePath } from 'next/cache'

export async function doThing(input) {
  await requireAdmin()
  const admin = createAdminClient()
  // ... query
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/...')
}
```

Errors are thrown (caught by the client `run()` wrapper in ShiftsView / similar). `revalidatePath` is always called after mutations — pass the full page path, e.g. `revalidatePath('/dashboard/shifts')`.

### API Routes

| Route | Purpose |
|-------|---------|
| `GET /api/dev/login` | Dev-only auto-login (403 in production) |
| `GET /api/cron/send-auto-messages` | Vercel Cron — **daily at midnight UTC** (downgraded from hourly 2026-07-11; the Hobby plan only allows daily cron, and the hourly schedule had been silently blocking every production deploy since ~2026-04-29). Dispatches scheduled ("Send Later") messages and daily auto-message rules on this single run — scheduled messages can now be delayed up to ~24h instead of near-real-time. Must include `Authorization: Bearer <CRON_SECRET>` header (fails closed if `CRON_SECRET` unset) |
| `POST /api/webhooks/vercel` | Vercel deploy events → Notion Dev Tasks status + preview URL. HMAC-verified via `VERCEL_WEBHOOK_SECRET` |
| `POST /api/push-subscription` | PWA push notification subscription management |

### Shared Components

`web/components/` holds truly shared UI:
- `Sidebar.tsx` — admin nav (import via `@/components/Sidebar`)
- `ui/` — low-level primitives

The `@/*` alias maps to `web/*`, so `@/components/Sidebar` and `@/lib/utils` both resolve correctly.

### Shell Components

- **`web/app/dashboard/DashboardShell.tsx`** — wraps all admin pages; provides `AdminLangProvider`. Rendered by `web/app/dashboard/layout.tsx`.
- **`web/app/volunteer/(tabs)/VolunteerShell.tsx`** — wraps volunteer tab pages; provides volunteer lang context.

These are the injection points for context providers. If you add a new context that all admin or volunteer pages need, add it here.

### Page + View Pattern

Every dashboard page follows a strict split:

- **`page.tsx`** — async server component, fetches all data with `createAdminClient()`, sets `export const dynamic = 'force-dynamic'` and calls `unstable_noStore()` (imported from `next/cache`) at the top of its fetch function, exports the page-specific TypeScript types (e.g. `ShiftWithRoster`), renders the `*View` component with typed props.
- **`*View.tsx`** — `'use client'` component, receives all data as props, owns all interactivity and state, imports actions from `./actions`.

Never fetch data in a `*View.tsx` — it receives everything from the page. Never put UI in `page.tsx` beyond rendering the View.

Complex pages (e.g. volunteers detail, settings) co-locate additional components alongside `page.tsx` (e.g. `AddVolunteerModal.tsx`, `VolunteersTable.tsx`) and may split a very large `actions.ts` into multiple action files (e.g. `settingsActions.ts`). All action files are `'use server'`.

Every `*View.tsx` uses a local `run()` helper for mutations (defined inline per-View — not importable because it closes over that View's `setError` and `router`):

```ts
async function run(fn: () => Promise<void>) {
  setError(null)
  try {
    await fn()
    startTransition(() => { router.refresh() })
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Something went wrong')
  }
}
```

`await fn()` runs the server action, then `router.refresh()` is wrapped in `startTransition` so `isPending` reflects the server re-fetch. This is the React 18 pattern — don't call `router.refresh()` outside a transition.

### Utilities

- `cn(...classes)` — Tailwind class merging via `clsx` + `tailwind-merge`. Import from `@/lib/utils`.
- Shared DB row types live in `web/types/database.ts` (hand-maintained, not auto-generated at build time). Regenerate after schema changes with `npx supabase gen types typescript --local > web/types/database.ts`.

### Key Data Patterns

**Soft-delete for shift assignments**: `removeAssignment` sets `status = 'cancelled'`, never hard-deletes. The `shift_assignments` table has `unique(shift_id, volunteer_id)`, so re-assigning a previously-cancelled volunteer requires an upsert (check for existing row, update rather than insert).

**Volunteer status flow**: `applicant` → `prospect` → `volunteer` → `inactive`. Gate feature access on `status === 'volunteer'`, not on `pipeline_phase`. The canonical phase→status mapping is `PHASE_STATUS_MAP` in `web/app/dashboard/volunteers/[id]/actions.ts` — don't duplicate this logic elsewhere.

**Hour approval status flow**: `auto_approved` (default on clock-out when no manual review needed) | `pending` (requires admin review) → `approved` | `rejected`. Admin approves/rejects in `/dashboard/reports`. The `approved_by` and `approved_at` fields are set on approval only.

**Message status flow**: immediate sends go `draft` → (email dispatch via `web/lib/email.ts`) → `sent` (or `failed` when every email bounces); scheduled sends go `scheduled` (has `scheduled_send_at`, `sent_at` null) → `sent` when the hourly cron dispatches them. Never set `sent_at` at insert time. `messages.sender_id` references `auth.users` (admins have no volunteers row).

**Single-org setup**: `org_id` is always resolved as `select('id').from('organizations').limit(1).single()`.

### Notion Automation Pipeline

When a branch is pushed or a PR is opened/merged, the system updates the Notion Dev Tasks & QA database automatically:

1. **PostToolUse hook** (`.claude/settings.local.json`) — git commit/push → marks task "In Progress"
2. **`notion-pr-sync.yml`** — PR opened/merged/closed → updates task status in Notion
3. **`/api/webhooks/vercel`** — deploy succeeded → moves task to "Testing" + stores preview URL in GitHub Link field

Task ID is extracted from the branch name (must contain `DEV-###`). **Branch names must follow `feat/DEV-###-slug` — the entire pipeline (hook → PR sync → webhook) fires only if the branch name contains a `DEV-###` token.** All steps silently no-op if Notion env vars are absent.

### i18n

Two separate React Context translation systems:
- **Volunteer UI**: `useT()` from `web/lib/volunteer-lang.tsx` (~130 keys, EN + ES)
- **Admin UI**: `useAdminT()` from `web/lib/admin-lang.tsx` (~300 keys, EN + ES)

All user-visible strings go through these hooks — no hardcoded English in JSX.

### Volunteer PWA

The volunteer app (`/volunteer`) is a full PWA. Key files:

- `web/public/sw.js` — service worker (cache name `medvolunteer-v2`). Static assets are cache-first; navigation is network-first with `/volunteer/offline` as the offline fallback.
- `web/public/manifest.json` — web app manifest.

When bumping the service worker (e.g. after cache invalidation), increment `CACHE_NAME` in `sw.js`. Old caches are deleted on activate.

### Hydration Gotcha

Never read `localStorage` in a `useState` initializer — it causes server/client mismatch. Use `useEffect`:

```ts
const [val, setVal] = useState('')
useEffect(() => { setVal(localStorage.getItem('key') ?? '') }, [])
```

## Project Roadmap & Task List

The current source of truth for project state, priorities, and the agent task list is **`ROADMAP.md`** in the repo root — read it at the start of every session before doing anything else. It supersedes Phases 9–10 of `MedVolunteer-roadmap.txt` (the SiteGround deploy plan is obsolete; deployment is on Vercel).


