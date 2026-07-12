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
| `NOTION_FEATURE_REQUESTS_DB_ID` | GitHub Secrets only | Feature Requests DB (AB-### tasks). Read by `auto-build-features.yml` **and** `notion-pr-sync.yml` — a PR on a `feat/AB-###` branch cannot sync without it |
| `CLAUDE_CODE_OAUTH_TOKEN` | GitHub Secrets only | Authenticates the Claude Code CLI in `auto-fix-bugs.yml` / `auto-build-features.yml` against the **Claude subscription quota** — not pay-as-you-go API credit. Mint with `claude setup-token` (valid ~1 year). **Do not also set `ANTHROPIC_API_KEY` in those workflows**: if both are present the API key takes precedence, and with an empty API balance every run dies with `Credit balance is too low` while still reporting green. Subscription usage limits still apply — a large `max_tasks` run can exhaust the 5-hour window |
| `VERCEL_WEBHOOK_SECRET` | `.env.local` | Webhook signature verification |
| `CRON_SECRET` | Vercel env + `.env.local` | Protects `/api/cron/*` routes |
| `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_ID` / `SUPABASE_DB_PASSWORD` | GitHub Secrets only | CI migration runner (`supabase-migrate.yml`). All three must point at the **same** project. `supabase link` fails fast and the error names the broken secret: `project is paused` / `Could not find project` → stale `SUPABASE_PROJECT_ID`; `your account does not have the necessary privileges` → the PAT is from an account without access to that project; `Invalid access token format. Must be like sbp_0102...1920` → the PAT is a 47-char `sbp_v0_...` token but the pinned CLI only accepts the **classic 44-char `sbp_` + 40-hex** format (the value can be perfectly clean — see the comment in the workflow). Repointing these at cutover is Step 1d of `docs/yakima-production-cutover.md` |

Local Notion automation is a no-op if `NOTION_TOKEN` is not set — it silently skips.

## Architecture

### Repo Layout

```
web/          Next.js 14 app (admin + volunteer UI)
supabase/     Migrations, seed data, edge functions
scripts/      notion-sync.cjs — Notion API helper used by hooks/CI
              build-heather-guide.cjs — generates Heather_Notion_Setup_Guide.docx
.github/      supabase-migrate.yml — auto-applies migrations on merge to main (push paths filter: supabase/migrations/**; single migrate job, concurrency-guarded)
              notion-pr-sync.yml — PR events → Notion status + PR link. Routes DEV-### to Dev Tasks DB and AB-### to Feature Requests DB.
              auto-fix-bugs.yml — nightly (2am UTC) Claude Code agent: reads "Ready" tasks from Notion Dev Tasks DB, opens PRs. Branch names follow fix/DEV-###-slug.
              auto-build-features.yml — nightly (3am UTC) Claude Code agent: reads "Ready" tasks from Notion Feature Requests DB, opens PRs. Branch names follow feat/AB-###-slug. Requires ANTHROPIC_API_KEY, NOTION_FEATURE_REQUESTS_DB_ID, GH_PAT secrets.
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

Two Notion databases feed the pipeline, distinguished by task ID prefix:

| Prefix | Database | Env var | Built by | Branch prefix |
|--------|----------|---------|----------|---------------|
| `DEV-###` | Dev Tasks & QA | `NOTION_DEV_TASKS_DB_ID` | `auto-fix-bugs.yml` (2am UTC) | `fix/` |
| `AB-###` | Feature Requests | `NOTION_FEATURE_REQUESTS_DB_ID` | `auto-build-features.yml` (3am UTC) | `feat/` |

Anything sitting in **Ready** is picked up by the nightly agent, which opens a PR. From there:

1. **PostToolUse hook** (`.claude/settings.local.json`) — git commit/push → marks task "In Progress"
2. **`notion-pr-sync.yml`** — PR opened/merged/closed → updates status + PR link in the DB matching the prefix
3. **`/api/webhooks/vercel`** — deploy succeeded → moves task to "Testing" + stores preview URL in GitHub Link field

**Branch names must follow `fix/DEV-###-slug` or `feat/AB-###-slug`** — the entire pipeline (hook → PR sync → webhook) fires only if the branch name contains a `DEV-###` or `AB-###` token. All steps silently no-op if Notion env vars are absent.

`scripts/notion-sync.cjs` reads each database's schema before writing, so it adapts to `Status` being a `select` *or* a `status` property, and to link fields being `url` *or* `rich_text`. Don't hardcode those payload shapes — a wrong guess is a hard 400 that fails the run.

**Task IDs are free text and not guaranteed unique.** Automation passes the Notion **page ID** — returned by `list-ready-features` — to `feature-status`, never the task ID. Keep it that way. (Two rows once shared `AB-00006`; `notion-sync.cjs` now logs a WARNING and uses the first match, so a duplicate silently writes status/PR links onto the wrong row. `notion-pr-sync.yml` can only look up by task ID — it has no page ID — so duplicates are a real hazard there.)

> ⚠️ `auto-build-features.yml` used to be gated on `notion-sync.cjs bugs-clear`, which skipped the entire run if any dev task sat in Ready / In Progress / **Code Review**. "Code Review" means an open PR awaiting a human merge, so the gate never cleared and no feature was built for weeks. **Gate removed 2026-07-11.** `bugs-clear` survives as a manual diagnostic only — don't reintroduce it as a gate.

#### Operating the pipeline — traps learned the hard way (2026-07-11)

**A blank `Component/File` means the agent invents the feature.** The task's `Component/File` rich-text field is the *entire* spec handed to Claude Code — the title alone is not enough. `AB-00006 "Group Volunteer"` was marked Ready with an empty description; the agent guessed it meant group shift signup and produced 13 files across admin + volunteer + i18n **including a new `supabase/migrations/*.sql`**. That path is exactly the trigger for `supabase-migrate.yml`, so merging it would have applied an agent-invented schema to production. **Never move a task to Ready without a real description.** Park under-specified tasks in Backlog.

**Closing a *conflicted* PR does not reset its Notion task.** `notion-pr-sync.yml` runs on `pull_request`, which GitHub dispatches against the merge ref (`refs/pull/N/merge`). A PR with conflicts has no valid merge ref, so **no workflow run fires at all** — including the `closed → Ready` step. The task is stranded in Code Review and the nightly agent will never pick it up again. After closing a conflicted PR, set the task back to Ready in Notion by hand. (For cleanly-mergeable PRs the `closed → Ready` path works — verified.)

**Prefer regeneration over hand-merging conflicts.** Every feature in a single run is branched from the same `main`, so once you merge the first PR, any other PR touching the same file conflicts. These branches are cheap and disposable: close the conflicted PR, set the task back to Ready, and re-run the workflow — the agent rebuilds against the new `main` and integrates with what just landed, rather than fighting it. (`AB-00005` conflicted with the merged `AB-00008` in `ShiftsView.tsx` across 5 hunks; a rebuild produced a clean, richer PR in ~3 minutes.) The workflow deletes any stale remote branch of the same name on the next run, so no cleanup is needed.

**The agent's failures used to look like successes.** `claude -p ... || true` swallowed every error, so a dead API key reported "No changes made — reverting to Ready" and the run went green. Both nightly workflows now `tee` Claude's output, grep it for account-level failures (credit / auth / usage limit), and `exit 1` with a `::error::` rather than reverting all tasks. If you ever see tasks bouncing back to Ready with no PRs, read the actual Claude output before believing "no changes".

### Supabase migration history

`supabase db push` refuses to run with `Remote migration versions not found in local migrations directory` whenever a version recorded in the remote's `supabase_migrations.schema_migrations` has no matching file in `supabase/migrations/`.

**This is caused by applying migrations out-of-band** — e.g. through the Supabase MCP connector or the SQL editor, which stamp their own timestamp rather than reusing the repo filename's. It happened with `precutover_hardening`: the repo has `20260711050700`, prod recorded `20260711050726`, and the demo project recorded `20260711050723` — three stamps, one file. The schema was identical in all three; only the bookkeeping diverged.

Fix is bookkeeping-only, never re-running the SQL:

```bash
supabase migration repair --status reverted <phantom-remote-version>
supabase migration repair --status applied  <version-matching-the-repo-file>
```

(Equivalently: delete the phantom row from `supabase_migrations.schema_migrations` and insert the repo's version.) **Prefer applying migrations via `supabase db push`** so the recorded version always matches the filename and this never arises.

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


