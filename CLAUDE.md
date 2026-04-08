# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A volunteer management platform for medical clinics — admin dashboard (`/dashboard`) + volunteer PWA (`/volunteer`), built on Next.js 14 and Supabase.

## Commands

All commands run from `web/`:

```bash
npm run dev       # Start Next.js dev server (port 3000)
npm run build     # Production build
npm run lint      # ESLint
```

Supabase (run from repo root, requires Docker):
```bash
npx supabase start         # Start local Supabase stack (port 54321)
npx supabase db reset      # Reset DB and re-run all migrations + seed.sql
npx supabase migration new <name>   # Create new migration file
```

Dev auto-login (development only):
```
GET http://localhost:3000/api/dev/login?role=admin&redirect=/dashboard/shifts
GET http://localhost:3000/api/dev/login?role=volunteer&redirect=/volunteer/home
```
Credentials are in `web/.env.local` (`DEV_ADMIN_EMAIL` etc.). Blocked with 403 in production.

## Environment Variables

Copy `web/.env.example` → `web/.env.local` for local dev. Key split:

| Var | Where | Purpose |
|-----|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | `.env.local` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Admin client (bypasses RLS) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | `.env.local` | Email sending |
| `NOTION_TOKEN` / `NOTION_DEV_TASKS_DB_ID` | `.env.local` + GitHub Secrets | Notion automation |
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
.mex/         Project memory submodule (patterns, context, drift detection)
.github/      supabase-migrate.yml — auto-applies migrations on merge to main
              notion-pr-sync.yml — PR events → Notion Dev Tasks status
```

### Route Structure

Three distinct user zones, each protected by its own layout:

| Zone | Root | Layout guard |
|------|------|-------------|
| Admin | `/dashboard` | `web/app/dashboard/layout.tsx` → redirect to `/login` |
| Volunteer PWA | `/volunteer/(tabs)` | `web/app/volunteer/layout.tsx` → redirect to `/volunteer/login` |
| Public | `/apply`, `/auth/callback`, `/login` | None |

No `middleware.ts` — auth is enforced exclusively via **server-side layout checks** (`createClient()` → `getUser()` → `redirect()`).

### Supabase Client Rules

Three clients — use the right one or RLS will block you:

| Client | File | When to use |
|--------|------|-------------|
| `createAdminClient()` | `web/lib/supabase/admin.ts` | All server actions, any write that must bypass RLS |
| `createClient()` | `web/lib/supabase/server.ts` | Server components reading the current user's own data |
| `createBrowserClient()` | `web/lib/supabase/client.ts` | Client components only |

**Non-negotiable**: All dashboard/admin mutations use `createAdminClient()`. Using `createClient()` in a server action will be silently blocked by RLS. This was a recurring bug — if a write fails with no obvious error, this is the first thing to check.

### Server Actions Pattern

Every `actions.ts` is `'use server'`. The standard shape:

```ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function doThing(input) {
  const admin = createAdminClient()
  // ... query
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/...')
}
```

Errors are thrown (caught by the client `run()` wrapper in ShiftsView / similar). `revalidatePath` is always called after mutations.

### API Routes

| Route | Purpose |
|-------|---------|
| `GET /api/dev/login` | Dev-only auto-login (403 in production) |
| `GET /api/cron/send-auto-messages` | Vercel Cron — daily midnight UTC, runs auto-message rules. Must include `Authorization: Bearer <CRON_SECRET>` header |
| `POST /api/webhooks/vercel` | Vercel deploy events → Notion Dev Tasks status + preview URL. HMAC-verified via `VERCEL_WEBHOOK_SECRET` |
| `POST /api/push-subscription` | PWA push notification subscription management |

### Key Data Patterns

**Soft-delete for shift assignments**: `removeAssignment` sets `status = 'cancelled'`, never hard-deletes. The `shift_assignments` table has `unique(shift_id, volunteer_id)`, so re-assigning a previously-cancelled volunteer requires an upsert (check for existing row, update rather than insert).

**Volunteer status flow**: `applicant` → `prospect` → `volunteer` → `inactive`. Gate feature access on `status === 'volunteer'`, not on `pipeline_phase`.

**Single-org setup**: `org_id` is always resolved as `select('id').from('organizations').limit(1).single()`.

### Notion Automation Pipeline

When a branch is pushed or a PR is opened/merged, the system updates the Notion Dev Tasks & QA database automatically:

1. **PostToolUse hook** (`.claude/settings.local.json`) — git commit/push → marks task "In Progress"
2. **`notion-pr-sync.yml`** — PR opened/merged/closed → updates task status in Notion
3. **`/api/webhooks/vercel`** — deploy succeeded → moves task to "Testing" + stores preview URL in GitHub Link field

Task ID is extracted from the branch name (must contain `DEV-###`). All steps silently no-op if Notion env vars are absent.

### i18n

Two separate React Context translation systems:
- **Volunteer UI**: `useT()` from `web/lib/volunteer-lang.tsx` (~130 keys, EN + ES)
- **Admin UI**: `useAdminT()` from `web/lib/admin-lang.tsx` (~300 keys, EN + ES)

All user-visible strings go through these hooks — no hardcoded English in JSX.

### Hydration Gotcha

Never read `localStorage` in a `useState` initializer — it causes server/client mismatch. Use `useEffect`:

```ts
const [val, setVal] = useState('')
useEffect(() => { setVal(localStorage.getItem('key') ?? '') }, [])
```

## After Every Task

Update `.mex/ROUTER.md` project state and any `.mex/` files that are now out of date. If no pattern existed for the task you just completed, create one in `.mex/patterns/`.

## Navigation

At the start of every session, read `.mex/ROUTER.md` before doing anything else.
