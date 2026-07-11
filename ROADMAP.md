# Envolv Roadmap & Agent Task List
*Originally written 2026-07-06. Updated 2026-07-11 (housekeeping pushed; A4 in progress — found and fixed a production deployment gap).*
*Supersedes Phases 9–10 of `MedVolunteer-roadmap.txt` (SiteGround plan is obsolete — we deploy on Vercel).*
*Context docs: `docs/ENVOLV-STATUS-2026-07-06.md` (full status assessment) and `docs/yakima-production-cutover.md` (cutover runbook).*

## Current status (2026-07-11)

- **Housekeeping pushed.** `main` is up to date with `origin/main` (tip `5128f44`), pushed via GitHub Desktop after the `engineering:github` connector turned out not to expose push/branch tools. D1's 5 flagged branches were already deleted from origin by the time of the push.
- **Discovered & fixed: production hadn't deployed since 2026-04-29.** Two compounding issues found while working A4: (1) the Vercel project's Framework Preset had drifted to "NestJS" instead of "Next.js" (fixed — reset to Next.js); (2) `vercel.json`'s cron for `/api/cron/send-auto-messages` was set to hourly (`0 * * * *`), which Vercel's Hobby plan doesn't allow (daily only) — this was silently rejecting every deploy attempt. **Decision (Sean, 2026-07-11): downgrade the cron to daily at midnight UTC** rather than upgrade to Pro. Consequence: "Send Later" scheduled messages can now be delayed up to ~24h instead of near-real-time (see `web/app/api/cron/send-auto-messages/route.ts` and `CLAUDE.md`). First fresh deployment triggered manually from `main` HEAD to confirm the fix.
- **A4 (Auth + env cutover) in progress:** `NEXT_PUBLIC_SUPABASE_URL`/anon key split into Preview-only (demo project) + Production-only (prod project `vopgctgjxbpytntthoxb`) entries in Vercel; `SUPABASE_SERVICE_ROLE_KEY` handled directly by Sean (not something Claude can view/copy). Supabase Auth Site URL/redirect URL change to `medvolunteer.vercel.app` still pending.
- **Preview app is live and healthy** on Vercel (`medvolunteer.vercel.app`; project `medvolunteer`, team `medvolreview`).
- **Dummy data is restored** in the preview Supabase project (`cquvutwulbtgklqrbamd`): `seed-demo.sql` (14 volunteers, shifts, hours, credentials, messages) is now wired into `supabase/config.toml` and loads on `db reset`.
- **Notion Feature Requests backlog populated (D4 done, Sean).** Nightly auto-build CI has real "Ready" tasks to pick up.
- **Before real data goes into prod:** pre-cutover DB hardening is 3 of 4 done — only H2 (leaked-password protection, manual dashboard toggle) remains. See the section at the bottom.

## For the agent reading this

- Read `CLAUDE.md` first and follow its conventions exactly (admin client rules, page+view pattern, i18n hooks, branch naming `feat/DEV-###-slug`). `CLAUDE.md` is the conventions source of truth; this file is the state/task source of truth. (There is no `.mex/` — references to it have been removed from `CLAUDE.md`.)
- Work one task at a time, in order within a workstream. Check the box, commit with a conventional message, and stop at any ⛔ item — those need Sean (credentials, DNS, client contact, or a business decision).
- Model routing: **Opus** for tasks tagged `[opus]` (architecture, multi-repo, ambiguous scope). **Sonnet** for `[sonnet]` (well-scoped implementation). Untagged = either.
- There is no test suite. Verify with `npm run build` + `npm run lint` from `web/`, and manual checks via the dev auto-login routes in `CLAUDE.md`.

## The big picture

Envolv, LLC is launching a multi-industry volunteer management SaaS (business plan: `volunteer-saas-business-plan.pdf`, repo root). Three deliverables, in priority order:

1. **Yakima Free Clinic** (this repo) — first client, single-tenant, live as a preview at medvolunteer.vercel.app. Needs production cutover.
2. **envolv.app marketing site** — owned domains currently serve empty pages. Needs a landing page.
3. **Envolv multi-tenant platform** — separate repo at `C:/Users/smmcn/Desktop/volunteerhub`. The real SaaS product; this repo becomes its medical vertical.

---

## Workstream A — Yakima production cutover 🔴 P0 (do first; now unblocked by the connectors)

Detailed commands in `docs/yakima-production-cutover.md`.

- [ ] ⛔ **A1. Decisions from Sean:** ✅ *Decided 2026-07-08* — (1) **fresh** Supabase prod project (preview stays for demos); (2) domain **`yakima.envolv.app`**. *Still needed before A3/A4:* envolv.app DNS host login (to add the CNAME); Resend domain verification for envolv.org; Yakima sign-off contact. *(Supabase access is now covered by the connector.)*
- [x] **A2. `[sonnet]` Reconcile edge functions.** ✅ 2026-07-08 — real count is **7** (advance-onboarding, background-check-webhook, clock-in, clock-out, initiate-background-check, send-message, send-push). The "8" was stale design intent: `MedVolunteer-roadmap.txt` planned a `docusign-webhook` that was never built (Phase 0 shipped 6, Phase 8 added send-push). E-signature is handled via the `documents.provider` column, not an edge function. Nothing is missing. Minor follow-up for A3: `send-push` lacks a `config.toml` block but deploys fine.
- [x] **A3. `[sonnet]` Production Supabase setup** (after A1): ✅ 2026-07-11 — fresh prod project `vopgctgjxbpytntthoxb` ("Envolv Yakima (prod)"), all 27 migrations applied, all 7 edge functions deployed ACTIVE, org renamed to Yakima Free Clinic, demo seed NOT run. Remaining: DB password reset + function secrets (RESEND_API_KEY, VAPID keys, CHECKR_*) per `docs/yakima-production-cutover.md`.
- [x] **A3.5 `[sonnet]` Pre-cutover DB hardening** — 3 of 4 items done 2026-07-11 via migration `20260711050700_precutover_hardening.sql`, applied to both the preview project and the prod project (`vopgctgjxbpytntthoxb`). ⛔ One item left — leaked-password protection is an Auth service setting, not scriptable from SQL/the Supabase MCP; needs a manual dashboard toggle. See "Pre-cutover DB hardening" below.
- [ ] **A4. `[sonnet]` Auth + env cutover — in progress 2026-07-11.** Target is `medvolunteer.vercel.app`, not `yakima.envolv.app` (domain deferred per A1). Done so far: found & fixed a production deployment gap (Framework Preset had drifted to NestJS; hourly cron exceeded the Hobby plan's daily-cron limit and was silently blocking every deploy since ~2026-04-29 — downgraded cron to daily at midnight UTC per Sean's decision, see `web/vercel.json` and `CLAUDE.md`); split `NEXT_PUBLIC_SUPABASE_URL`/anon key into Preview-only (demo) + Production-only (prod `vopgctgjxbpytntthoxb`) Vercel env vars; triggered a fresh deploy from `main` HEAD. Still open: `SUPABASE_SERVICE_ROLE_KEY` env var (Sean must copy/paste this directly — Claude cannot view secret keys), Supabase Auth Site URL/redirect URL → `medvolunteer.vercel.app`, CI migration secrets (`SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID`) repointed to prod (needs GitHub repo admin). Acceptance: magic-link invite works end-to-end on the prod domain.
- [ ] **A5. `[sonnet]` First real data:** Yakima org row, first admin auth user + `volunteers` row (`status='active'`), VAPID keys set in Settings → Web Push.
- [ ] **A6. Smoke test** — full checklist in the runbook (logins, PWA install, offline page, push, geofence clock-in, cron auth, Lighthouse ≥ 90). Acceptance: every box checked on the production domain.
- [ ] ⛔ **A7. Client sign-off** with Yakima; deliver credentials securely.

## Workstream B — envolv.app marketing site 🟡 P1 (second)

- [ ] **B1. `[opus]` Scaffold the site.** New Next.js project (separate repo `envolv-www` or `/marketing` app in volunteerhub repo — decide and document). One-page landing: positioning from the business plan (mobile-first, industry templates, undercuts Volgistics), pricing tiers ($29 Starter / $79 Professional / $199 Enterprise, ~17% annual discount), demo-request email capture (Resend, `noreply@envolv.org`). Acceptance: builds clean, deploys to a new Vercel project.
- [ ] ⛔ **B2. DNS:** point envolv.app (+ www, and envolv.org redirect → envolv.app) at the Vercel project.
- [ ] **B3. `[sonnet]` Email capture backend:** store signups (Supabase table or Resend audience) — this also closes the "Email list" stub in the Notion Feature Requests DB.
- [ ] **B4. `[sonnet]` SEO basics:** metadata, OG image, robots.txt, sitemap. Acceptance: Lighthouse SEO ≥ 95.

## Workstream C — Envolv multi-tenant platform 🟢 P2 (third)

Repo: `C:/Users/smmcn/Desktop/volunteerhub` (exists; not yet assessed). Plan: `docs/superpowers/plans/2026-03-21-volunteerhub-phase-1-foundation.md`.

- [ ] **C1. `[opus]` Assess actual state** of the volunteerhub repo vs. the Phase 1 plan (scaffold, `[orgSlug]` routing, verticals registry, Supabase schema). Output: gap list appended to this file.
- [ ] **C2. `[sonnet]` Rename VolunteerHub → Envolv** everywhere (VolunteerHub is a competitor's trademark). Repo folder, package name, UI strings, plan docs.
- [ ] **C3. `[opus]` Complete Phase 1 foundation** per the plan: multi-tenant path routing, vertical configs (medical, animal-shelter, food-bank, nonprofit), OrgProvider, RLS. Acceptance: two seed orgs render branded dashboards with correct vertical labels; Vitest unit tests pass.
- [ ] **C4. `[opus]` Migration strategy doc:** how medvolunteer's features (shifts, onboarding, LMS, messages, PWA) port into the multi-tenant architecture, and what happens to the Yakima instance (stays standalone vs. migrates to a `yakima` org slug). ⛔ Decision needed from Sean before implementation.
- [ ] ⚖️ Note: founders agreement §3.1 — entering a vertical not in the strategic plan requires unanimous founder consent. Stick to the four planned verticals.

## Workstream D — Pipeline & housekeeping 🔵 P3 (parallel, any time)

- [x] **D1. Push this housekeeping + delete the merged remote branches.** ✅ 2026-07-11 — pushed via GitHub Desktop (`@Volistapp`, added as a collaborator; sandbox still has no git credentials, and the `engineering:github` connector never exposed push/branch tools). `origin/main` tip is `5128f44`. The 5 branches this task originally listed were already gone from origin by the time of the push. `fix/DEV-00010-category-of-shifts-not-filtering-correctly` is still an open PR (#7) — left alone, along with `vercel/install-vercel-web-analytics-h9gqg7` and `claude/add-claude-documentation-Oaavt` (both unmerged).
- [x] **D2. Fix `CLAUDE.md`** — removed the dead `.mex/` navigation and "After Every Task" sections (the submodule was never initialized) and pointed the file at this ROADMAP. ✅ 2026-07-10
- [x] **D3. Archive `MedVolunteer-roadmap.txt`** — added a superseded banner and flagged Phases 9–10 as obsolete (SiteGround → Vercel). ✅ 2026-07-10
- [x] **D4. Populate Notion Feature Requests** with a real backlog and mark items "Ready" ✅ 2026-07-11 (Sean) — the nightly auto-build CI now has real tasks to pick up.
- [ ] ⛔ **D5. Commit or remove the untracked PDFs** in the repo root (business plan, projections, targeting strategy) — they're marked CONFIDENTIAL and likely belong outside the repo. Sean decides.

## Workstream E — Business (Sean only, not for agents)

- [ ] Confirm §5.1 capital contributions were finalized (30-day window closed ~May 9).
- [ ] Customer discovery: 20+ interviews across 3–4 target verticals.

## Pre-cutover DB hardening

Run these before any real data goes into the production project — fold them into a migration where possible so they carry into prod. Sourced from the Supabase advisors on the preview project (`cquvutwulbtgklqrbamd`):

- [x] Set an explicit `search_path` on the 2 flagged functions (mutable `search_path` warning). ✅ 2026-07-11 — `update_updated_at` and `enforce_shift_capacity` pinned to `'public, pg_temp'` (both reference unqualified tables, so search_path couldn't be emptied). Verified: `function_search_path_mutable` no longer appears in `get_advisors`.
- [ ] ⛔ Enable Auth leaked-password protection (HaveIBeenPwned check) in the Auth settings. Not scriptable — this is a GoTrue/Auth service config, not a database object, and the Supabase MCP has no auth-config tool. Do it manually for both projects: Dashboard → Authentication → Policies → Password Security → "Leaked password protection" → on. Needed on preview (`cquvutwulbtgklqrbamd`) and prod (`vopgctgjxbpytntthoxb`).
- [x] Review and revoke `anon` + `authenticated` SELECT on admin-only tables — 39 are exposed via the auto-generated GraphQL/PostgREST schema. ✅ 2026-07-11 — went further than SELECT: revoked *all* privileges (`REVOKE ALL ... FROM anon, authenticated`) on all 39 tables, since grep confirmed no client-side code queries tables directly (browser client is auth-only — see below). Also added `ALTER DEFAULT PRIVILEGES` so future tables don't get default grants. Verified: `pg_graphql_anon_table_exposed`/`_authenticated_table_exposed` no longer appear in `get_advisors`; `role_table_grants` for anon/authenticated on `public` is empty.
- [x] Confirm the volunteer-facing tables the PWA reads still have the RLS policies they need, so tightening the above doesn't break the volunteer app. ✅ 2026-07-11 — turns out this is moot: grepped `web/` for `createBrowserClient`/`from(` and confirmed the browser client (`@/lib/supabase/client`) is only ever used for Supabase Auth calls (`signInWithPassword`, `signOut`, `updateUser`, `getUser`) in Sidebar, `/login`, `/volunteer/forgot-password`, `/volunteer/set-password`, `VolunteerLoginForm`, and `ProfileView`. There is no client-side `.from(...)` table query anywhere — matches `CLAUDE.md`'s documented architecture (all data access via `createAdminClient()` after a server-side auth guard). So revoking anon/authenticated table grants entirely can't break the PWA.

Migration: `supabase/migrations/20260711050700_precutover_hardening.sql`. Applied directly to both the preview project and the prod project via the Supabase connector, and committed to the migrations folder so it also applies cleanly to any future `db reset` / fresh project.
