# Envolv Roadmap & Agent Task List
*Originally written 2026-07-06. Updated 2026-07-12 (demo now tracks `main`; scheduled-message cron moved to GitHub Actions; CI migration runner fixed; A4 fully closed; Workstream F added — pricing-page feature parity).*
*Supersedes Phases 9–10 of `MedVolunteer-roadmap.txt` (SiteGround plan is obsolete — we deploy on Vercel).*
*Context docs: `docs/ENVOLV-STATUS-2026-07-06.md` (full status assessment) and `docs/yakima-production-cutover.md` (cutover runbook).*

## Current status (2026-07-12)

- **Housekeeping pushed.** `main` is up to date with `origin/main` (tip `c48e430`, 2026-07-12), pushed via GitHub Desktop after the `engineering:github` connector turned out not to expose push/branch tools. D1's 5 flagged branches were already deleted from origin by the time of the push, but **a fresh crop of 9 stale remote branches has since accumulated — see D10.**
- **Found, fixed, and confirmed: production hadn't deployed since 2026-04-29.** Two compounding issues found while working A4: (1) the Vercel project's Framework Preset had drifted to "NestJS" instead of "Next.js" (fixed — reset to Next.js); (2) `vercel.json`'s cron for `/api/cron/send-auto-messages` was set to hourly (`0 * * * *`), which Vercel's Hobby plan doesn't allow (daily only) — this was silently rejecting deploy creation itself (the GitHub webhook was fine all along). **Decision (Sean, 2026-07-11): downgrade the cron to daily at midnight UTC** rather than upgrade to Pro. Fix committed (`774424e`) and pushed; the push auto-triggered a Production build that finished **Ready** — confirms the deploy pipeline is unblocked and current `main` (not the Apr 29 build) is now live. **The ~24h "Send Later" delay this caused was then eliminated by moving scheduled-message dispatch to GitHub Actions — see D9.**
- **✅ "Send Later" is back to near-real-time via GitHub Actions (D9, `54d5934`).** Vercel Hobby caps cron at one run/day, so `.github/workflows/cron-scheduled-messages.yml` now calls the same route every 30 min. Worst-case latency: **~30 min, not ~24h.** The daily auto-message rules stay on Vercel's midnight cron. Both required secrets (`APP_URL`, `CRON_SECRET`) confirmed in place 2026-07-12.
- **✅ Yakima production is LIVE and login works (2026-07-11).** `medvolunteer.vercel.app` → prod Supabase `vopgctgjxbpytntthoxb`, verified by decoding the deployed JS bundle (correct project URL + matching `anon`-role key). All three admins (Heather, Gingin, Sean) exist, are confirmed, and are in `admin_users`. Admin login, wrong-password error, and the volunteer portal all confirmed working.
- **The outage that got us here (resolved).** Admin login hung forever on "Signing in…". The first successful production deploy since 2026-04-29 shipped **without** `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` — not because they were missing from Vercel, but because **`NEXT_PUBLIC_*` is inlined at build time and the vars were saved (17:53 UTC) ~10h *after* the last build (07:17 UTC)**. Env var changes never apply retroactively to an existing build. The browser client got `undefined`, `createClient()` threw synchronously inside `handleLogin` before any network call, and with no `try/catch` the loading state never cleared. Neither Supabase project logged a single auth request — the request never left the browser. Fixed in code (A4.5) + redeploy.
- **⚠️ The recurring theme today was env-var misconfiguration — three separate incidents.** (1) vars saved after the build, so not inlined; (2) `NEXT_PUBLIC_SUPABASE_*` scoped to *all* environments, so the `demo` **preview build pointed at the live clinic database** (caught before any demo traffic); (3) `NEXT_PUBLIC_SITE_URL`'s value pasted into `NEXT_PUBLIC_SUPABASE_URL`, breaking demo login with a `JSON.parse` error (Supabase's endpoint returned Vercel's 404 HTML). **Lesson: never trust the Vercel dashboard to tell you what the app got — decode the deployed JS bundle.** Vercel masks "Sensitive" values so you cannot read back what's in a field; the bundle is the only ground truth.
- **✅ A4 (Auth + env cutover) — DONE, all items closed.** Prod env vars confirmed correct **in the deployed bundle** (not just the dashboard). Supabase Auth Site URL / redirect URL → `medvolunteer.vercel.app` set on the prod project. `NEXT_PUBLIC_SITE_URL` checked by Sean (it gates volunteer invite links — see the landmine note under A5). **The last open item — the CI migration secrets — closed 2026-07-12** (`3fb950f`): the failure was never a bad secret but a CLI-version mismatch. `supabase-migrate.yml` is now pinned to CLI `2.84.2`, which accepts the classic 44-char `sbp_` token; `version: latest` was silently falling back to a stale CLI when unauthenticated GitHub API resolution got rate-limited. See the comment block in the workflow before touching it.
- **✅ Demo environment is a separate Vercel project, and as of 2026-07-12 it tracks `main` — see D6/D8.** `envolv-demo.vercel.app` → demo Supabase `cquvutwulbtgklqrbamd`. Isolation by construction: separate project, separate env vars, nothing shared to misconfigure. Verified in the bundle — demo points at `cquvut…` with **no prod ref leaked**. The old `demo` branch is gone; both projects build `main` and differ only in env vars, so the demo can no longer fall behind.
- **Preview app is live and healthy** on Vercel (`medvolunteer.vercel.app`; project `medvolunteer`, team `medvolreview`).
- **Dummy data is restored** in the preview Supabase project (`cquvutwulbtgklqrbamd`): `seed-demo.sql` (14 volunteers, shifts, hours, credentials, messages) is now wired into `supabase/config.toml` and loads on `db reset`.
- **Notion Feature Requests backlog populated (D4 done, Sean).** Nightly auto-build CI has real "Ready" tasks to pick up.
- **Before real data goes into prod:** pre-cutover DB hardening is 3 of 4 done — only H2 (leaked-password protection, manual dashboard toggle) remains. See the section at the bottom.
- **Pricing-page feature audit done (2026-07-12).** Every feature sold on the envolv.app pricing page was audited against this repo; 16 build prompts for the gaps (plan tiers/billing, industry templates, SMS dispatch, kiosk mode, public API, roles, white-label, multi-org, SSO, trust docs, and more) live in `docs/pricing-page-feature-prompts.md`, sized for the Notion AB-### pipeline. Tracked as **Workstream F**.

## For the agent reading this

- Read `CLAUDE.md` first and follow its conventions exactly (admin client rules, page+view pattern, i18n hooks, branch naming `feat/DEV-###-slug`). `CLAUDE.md` is the conventions source of truth; this file is the state/task source of truth. (There is no `.mex/` — references to it have been removed from `CLAUDE.md`.)
- Work one task at a time, in order within a workstream. Check the box, commit with a conventional message, and stop at any ⛔ item — those need Sean (credentials, DNS, client contact, or a business decision).
- Model routing: **Opus** for tasks tagged `[opus]` (architecture, multi-repo, ambiguous scope). **Sonnet** for `[sonnet]` (well-scoped implementation). Untagged = either.
- There is no test suite. Verify with `npm run build` + `npm run lint` from `web/`, and manual checks via the dev auto-login routes in `CLAUDE.md`. Note: `npm run lint` currently reports **3 pre-existing errors in `web/server.js`** (`require()` style imports) and ~35 warnings. `server.js` is the dead Phusion Passenger entry point from the abandoned SiteGround plan — nothing imports it, and `next build` doesn't lint root-level files, which is why deploys pass. Ignore those 3; a clean lint means deleting `server.js`.
- 🛑 **If you are an agent working through the Cowork sandbox: NEVER run `git` (especially `git add`/`git commit`), `npm run build`, `npm run lint`, or `tsc` through the Linux bash mount for this repo.** Use the Read/Write/Edit file tools — they go to Windows directly and are accurate. Have Sean build and commit on Windows.

  **The precise failure (re-diagnosed 2026-07-12 — the earlier "stale stat data" explanation was wrong and undersold it):** the mount serves a **truncated prefix** of each file. It is byte-accurate from the start of the file and then simply *stops* — `envolv-todo.html` came back as 34,876 bytes ending mid-word (`closed ~Ma`), with no closing `</html>`. It is **not** a staleness problem: the mount reflected edits made seconds earlier, and its line 236 matched Windows' line 236 exactly. Fresh content, cut short.

  **Why that is dangerous rather than merely annoying:** git compares those truncated working-tree files against intact `HEAD` blobs, so it reports the missing tails as *deletions*. A `git diff` through the sandbox showed **898 deletions across 18 files** — all phantom. **A `git add -A && git commit` in the sandbox would commit those truncations as real deletions**, silently amputating the back half of `ShiftsView.tsx` and 17 other files in a commit that looks perfectly clean. Treat any sandbox `git status`/`git diff` output for this repo as fiction.

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
- [x] **A3. `[sonnet]` Production Supabase setup** (after A1): ✅ 2026-07-11 — fresh prod project `vopgctgjxbpytntthoxb` ("Envolv Yakima (prod)"), all **28** migrations applied (27 + `20260711050726_precutover_hardening`), all 7 edge functions deployed ACTIVE, org renamed to Yakima Free Clinic, demo seed NOT run. Schema re-verified 2026-07-11: 39 tables, org row + 5 categories + 5 onboarding stages + learning modules present. Remaining: DB password reset + function secrets (RESEND_API_KEY, VAPID keys, CHECKR_*) per `docs/yakima-production-cutover.md`.
- [x] **A3.5 `[sonnet]` Pre-cutover DB hardening** — 3 of 4 items done 2026-07-11 via migration `20260711050700_precutover_hardening.sql`, applied to both the preview project and the prod project (`vopgctgjxbpytntthoxb`). ⛔ One item left — leaked-password protection is an Auth service setting, not scriptable from SQL/the Supabase MCP; needs a manual dashboard toggle. See "Pre-cutover DB hardening" below.
- [x] **A4. `[sonnet]` Auth + env cutover — FULLY DONE.** Env/auth cutover 2026-07-11; the last remaining item (CI migration secrets) closed 2026-07-12 — see Current status. No open sub-items.

  *Original notes retained below for history.*

  **A4 (original entry). `[sonnet]` Auth + env cutover — in progress 2026-07-11.** Target is `medvolunteer.vercel.app`, not `yakima.envolv.app` (domain deferred per A1). Done so far: found, fixed, and confirmed a production deployment gap (Framework Preset had drifted to NestJS; hourly cron exceeded the Hobby plan's daily-cron limit and was silently blocking every deploy since ~2026-04-29 — downgraded cron to daily at midnight UTC per Sean's decision, commit `774424e`, pushed and confirmed Ready on Production); split `NEXT_PUBLIC_SUPABASE_URL`/anon key into Preview-only (demo) + Production-only (prod `vopgctgjxbpytntthoxb`) Vercel env vars; Supabase Auth Site URL/redirect URL → `medvolunteer.vercel.app` saved and confirmed on the prod project. Still open (all need Sean directly): `SUPABASE_SERVICE_ROLE_KEY` Vercel env var (Claude cannot view/copy secret keys), CI migration secrets (`SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID`) repointed to prod (needs GitHub repo admin). Acceptance: magic-link invite works end-to-end on the prod domain — not yet verified, blocked on the service role key being in place.
- [x] **A4.5 `[sonnet]` Fix admin login hang + wire admin password reset.** ✅ **DONE, DEPLOYED, AND VERIFIED 2026-07-11** (commit `e8e8241`). Live on `medvolunteer.vercel.app`: bundle decodes to the correct prod Supabase project, "Forgot password?" is a real `<a href="/forgot-password">`, and admin login succeeds. Two independent bugs, both surfaced by the first successful deploy since Apr 29:
  1. **Login hang.** `web/lib/supabase/client.ts` used `!` non-null assertions, so a missing `NEXT_PUBLIC_SUPABASE_*` was invisible to TypeScript; at runtime `createClient()` threw synchronously inside `handleLogin`, and with no `try/catch` `setLoading(false)` never ran → infinite spinner, no error shown. Fixed: `client.ts` now checks explicitly and throws a named, actionable error listing exactly which var is missing; `handleLogin` wrapped in `try/catch/finally` so config errors render instead of hanging.
  2. **"Forgot password?" never worked.** It was a decorative `<span>` on `/login` — no `href`, no `onClick`, no handler — and there was **no admin reset route in the app at all** (only `/volunteer/forgot-password`). Fixed: added `web/app/forgot-password/page.tsx` and `web/app/set-password/page.tsx`, and made the link a real `<Link>`. Also fixed `web/app/auth/callback/route.ts`, which sent *every* recovery error to `/volunteer/login` — an admin resetting their password was stranded in the volunteer app.

  Acceptance: a wrong password shows "Invalid login credentials" (not a hanging spinner); Forgot password → email → `/set-password` → `/dashboard`.
- [ ] **A5. `[sonnet]` First real data.** ✅ Done: Yakima org row (seeded) and **the three admin users** — `heatherismith52@gmail.com`, `ginginoverbay@gmail.com`, `emailsean@duck.com` created 2026-07-11, confirmed, with `admin_users` rows. Heather has signed in successfully.

  Still open:
  - **VAPID keys** (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` + edge function secrets) — push notifications don't work without them.
  - **Yakima's real volunteers** — prod `volunteers` is still empty (0 rows). This is correct and intentional; the clinic enters its own people. Nothing to migrate from the demo project.

  **⚠️ Landmine to re-check before Heather invites anyone: `NEXT_PUBLIC_SITE_URL`.** It is used in exactly one place — building the volunteer invite link in `web/app/dashboard/volunteers/actions.ts:61` — and it falls back to `http://localhost:3000`. If it is not set on the **prod** Vercel project, every invite email contains a dead `http://localhost:3000/auth/callback` link: the admin sees "invite sent," the volunteer gets nothing, and nobody finds out for weeks. It is `NEXT_PUBLIC_`, so **it is inlined at build time — setting it requires a redeploy.** Sean checked this 2026-07-11; re-verify after any env change. It was missing from `CLAUDE.md`'s env table, which is how it went unnoticed.

  Schema notes (the previous version of this task got both wrong): **an admin is a row in `admin_users`, not a `volunteers` row** — admins have no volunteers row at all. And the `volunteers.status` enum is `applicant → prospect → volunteer → inactive`; there is no `'active'`. Feature access is gated on `status = 'volunteer'`.
- [ ] **A6. Smoke test** — full checklist in the runbook (logins, PWA install, offline page, push, geofence clock-in, cron auth, Lighthouse ≥ 90). Acceptance: every box checked on the production domain.
- [ ] ⛔ **A7. Client sign-off** with Yakima; deliver credentials securely.

## Workstream B — envolv.app marketing site 🟡 P1 (second)

- [x] **B1. `[opus]` Scaffold the site.** ✅ 2026-07-12 — **decision: separate repo, `C:\Users\smmcn\Projects\envolv-www`** (rationale in that repo's `DECISIONS.md`). Rejected the `/marketing`-in-volunteerhub option because volunteerhub is still unassessed (C1) and about to be renamed (C2) — the landing page would have been blocked behind both. Separate repo = separate Vercel project = separate failure domain, and B2's DNS cutover points at one thing.

  Built: Next 14 App Router + Tailwind v4 (same stack as `web/`, so nothing new to learn). One page — hero, feature grid, six industry templates, a sourced comparison table, three pricing tiers with a monthly/annual toggle ($29/$79/$199, ~17% off annually), and a demo-request form. Every claim (prices, competitor figures, verticals) lives in `lib/content.ts` and traces to `volunteer-saas-business-plan.pdf` / `industry-targeting-strategy.pdf` — not scattered through JSX.

  Demo capture: server action → Resend → all addresses in `DEMO_NOTIFY_EMAILS`, `reply_to` set to the lead so you can just hit reply. Honeypot field, no third-party form service.

  **Two deliberate choices worth knowing:**
  - **Nothing here is `NEXT_PUBLIC_*` except the demo URL.** The Resend key and recipient list are read at *request* time, so changing them takes effect without a redeploy. This is a direct reaction to the 2026-07-11 prod login outage — build-time inlining is a trap and this repo shouldn't inherit it.
  - **A failed send surfaces an error and a fallback address rather than a fake "thanks!".** Until B3 lands there is no database behind this form: if Resend fails and we swallow it, the lead is simply gone.

  ⛔ **Blocked on Sean before it can go live:** (1) the two co-founder addresses for `DEMO_NOTIFY_EMAILS` — deliberately *not* guessed, since the Yakima admin addresses belong to the clinic, not to Envolv; (2) `RESEND_API_KEY`; (3) envolv.org Resend domain verification, without which `noreply@envolv.org` 403s and `onboarding@resend.dev` must be used as the `from`. And `npm install && npm run build` still needs a run on Windows — per `CLAUDE.md`, the sandbox is not trusted to build.
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

- [x] **D1. Push this housekeeping + delete the merged remote branches.** ✅ 2026-07-11 — pushed via GitHub Desktop (`@Volistapp`, added as a collaborator; sandbox still has no git credentials, and the `engineering:github` connector never exposed push/branch tools). `origin/main` tip was `5128f44` at the time. The 5 branches this task originally listed were already gone from origin by the time of the push. *(Superseded: `fix/DEV-00010-category-of-shifts-not-filtering-correctly` was an open PR (#7) then; it has since merged as `94c9c64`. A fresh crop of stale branches has accumulated — tracked as **D10**.)*
- [x] **D2. Fix `CLAUDE.md`** — removed the dead `.mex/` navigation and "After Every Task" sections (the submodule was never initialized) and pointed the file at this ROADMAP. ✅ 2026-07-10
- [x] **D3. Archive `MedVolunteer-roadmap.txt`** — added a superseded banner and flagged Phases 9–10 as obsolete (SiteGround → Vercel). ✅ 2026-07-10
- [x] **D4. Populate Notion Feature Requests** with a real backlog and mark items "Ready" ✅ 2026-07-11 (Sean) — the nightly auto-build CI now has real tasks to pick up.
- [ ] ⛔ **D5. Commit or remove the untracked PDFs** in the repo root (business plan, projections, targeting strategy) — they're marked CONFIDENTIAL and likely belong outside the repo. Sean decides.
- [x] **D6. Demo environment isolation** ✅ 2026-07-11 — runbook: `docs/demo-environment-setup.md`.

  **Why:** the first attempt used Vercel Preview scoping, and the `demo` preview build came up pointing at the **live clinic database** (confirmed in the bundle). Caught before any demo traffic hit it. Scoping via checkboxes was too thin a margin with a real clinic in prod, so the demo now lives in its own Vercel project — separate env vars, nothing shared to misconfigure.

  | | `medvolunteer` | `envolv-demo` |
  |---|---|---|
  | Branch | `main` | `main` *(was `demo` until 2026-07-12 — see D8)* |
  | URL | `medvolunteer.vercel.app` | `envolv-demo.vercel.app` |
  | Supabase | `vopgctgjxbpytntthoxb` (real clinic) | `cquvutwulbtgklqrbamd` (14 fake volunteers) |

  Also done: **deleted `medvolunteer-5wjx`**, an accidental duplicate Vercel project wired to the same repo that had been shadow-building every commit since 07:05 UTC (framework never configured, serving publicly).

  **✅ Closed 2026-07-12 — the *Ignored Build Step* is now set on `medvolunteer`,** which is what makes the preview-credential leak structurally impossible rather than merely fixed. It had never actually been applied: the prod project was still building `feat/AB-*` previews with production env vars. Vercel now offers this as a built-in behavior, so no custom script is needed — Settings → Build and Deployment → Ignored Build Step → Behavior: **`Only build production`** (`if [ "$VERCEL_ENV" == "production" ]; then exit 1; else exit 0; fi`; exit **1** = build, exit **0** = skip). Feature-branch previews are still built by `envolv-demo` against the fake DB — which is where a PR should be reviewed anyway.

  **Standing rule (revised 2026-07-12 — see D8): same code, different data. Both projects build `main`; the database comes from the project's env vars.**
- [x] **D8. Demo must always be current — demo now tracks `main`** ✅ 2026-07-12. The `demo` branch was never merged forward and the demo site sat **17 commits behind** `main`, serving a July 11 build while every AB-000xx feature (edit/duplicate shifts, shortcodes, statuses, categories, view-password) shipped to prod. Sales demos were showing stale software.

  The branch was load-bearing for nothing: **data isolation lives in the project's env vars, not the branch.** Fixed by pointing `envolv-demo` → Settings → Environments → Production → Branch Tracking at **`main`**, redeploying current `main` to production on that project, and deleting the `demo` branch. Both projects now build every push to `main`; the demo cannot drift again without someone actively breaking it.

  Verified: the live demo bundle resolves to `cquvutwulbtgklqrbamd` and contains **no** `vopgct…`; the login page shows the AB-00010 password-eye toggle (a main-only feature). **Do not recreate the `demo` branch.**
- [x] **D7. Fix demo seed emails** ✅ 2026-07-11 — `supabase/seed-demo.sql` used `@example.com` for all 14 volunteers. That domain is IANA-reserved and refuses all mail, so one "message all volunteers" click on the demo would have produced **14 hard bounces against `envolv.org`** — the same sending domain Yakima's real volunteer invites depend on. Enough bounces and production invites start landing in spam with no obvious cause. Swapped to `smmcneal+<name>@gmail.com` plus-aliases (deliverable, zero bounces, and an invite can be shown arriving in a real inbox during a demo). Both the seed file and the 14 live rows in the demo project are updated. Demo gets its own Resend API key.
- [x] **D9. Scheduled-message dispatch moved to GitHub Actions** ✅ 2026-07-11 (`54d5934`). Downgrading `vercel.json`'s cron to daily (Hobby-plan limit) fixed deploys but broke the "Send Later" feature in practice — a message scheduled for 2pm would not go out until the next midnight-UTC run. `.github/workflows/cron-scheduled-messages.yml` now calls the same route **every 30 min**, so worst-case latency is ~30 min instead of ~24h.

  **Two things to know before touching it:**
  - **The `?mode=scheduled` query param is load-bearing.** It dispatches due scheduled messages and *skips the daily auto-message rules*. The daily rules are **not idempotent** — they're gated only by a UTC-hour check, and the 00:00 and 00:30 invocations both land inside the 00:00 UTC hour, so calling the route without the param would **send every daily reminder twice**. The daily rules stay on Vercel's midnight cron, where they fire exactly once. The scheduled-message pass *is* idempotent (rows flip to `status='sent'`; the query only selects `status='scheduled'`).
  - **Cadence is a billing constraint, not a preference.** GitHub bills a 1-minute minimum per run, so *frequency* is the cost. `*/30` ≈ 1,450 min/month, inside the 2,000-min free tier for private repos; `*/15` would hit ~2,900 and blow past it.

  Requires two GitHub secrets: `APP_URL` (prod base URL, no trailing slash) and `CRON_SECRET` (must match Vercel's). The workflow fails loudly if either is missing. **✅ Both confirmed in place by Sean 2026-07-12** — "Send Later" is live, ~30 min worst-case latency.
- [ ] **D10. Delete the stale remote branches (round 2).** Origin currently carries 9 non-`main` branches. The 6 AB branches were **squash-merged**, so `git branch --merged` does not list them — verify against the merged commit, not the merge base, before deleting:

  | Branch | Status |
  |---|---|
  | `feat/AB-00005-edit-shift-buttons` | squash-merged (`95e280f`) — delete |
  | `feat/AB-00006-add-and-edit-status` | squash-merged (`14a9d5b`) — delete |
  | `feat/AB-00007-category-of-shift` | squash-merged (`5e45da2`) — delete |
  | `feat/AB-00008-duplicate-shifts` | squash-merged (`4509b87`) — delete |
  | `feat/AB-00009-shortcodes` | squash-merged (`dbed62e`) — delete |
  | `feat/AB-00010-view-password` | squash-merged (`583860e`) — delete |
  | `feat/AB-00006-group-volunteer` | ⚠️ **never merged, and should not be** — the agent-invented feature from the blank-`Component/File` incident (see CLAUDE.md). It contains an invented `supabase/migrations/*.sql`, which would trigger `supabase-migrate.yml` against production. Delete the branch, and make sure its Notion task is parked in **Backlog with a real description**, not Ready. |
  | `vercel/install-vercel-web-analytics-h9gqg7` | unmerged, stale — ⛔ Sean decides |
  | `claude/add-claude-documentation-Oaavt` | unmerged, stale — ⛔ Sean decides |

  Note the duplicate `AB-00006` across two branches — exactly the hazard CLAUDE.md flags under "Task IDs are free text and not guaranteed unique."
- [x] **D11. First successful nightly auto-build wave** ✅ 2026-07-11. After the pipeline fixes (`7013d6a` removed the never-clearing `bugs-clear` gate; `f68159f` moved Claude Code auth to the subscription OAuth token and made account-level failures `exit 1` instead of reporting green), the feature agent shipped its first real batch — **6 merged PRs**: AB-00005 edit shift buttons, AB-00006 add/edit status, AB-00007 shift categories, AB-00008 duplicate shifts, AB-00009 shortcodes, AB-00010 view password. `fix/DEV-00010` (category filtering) also merged as PR #7. This is the work the demo was 17 commits behind on — see D8.

## Workstream F — Pricing-page feature parity 🟡 P1–P2 (feeds the nightly AB pipeline)

The envolv.app pricing page sells features this repo doesn't have yet. Full audit + one ready-to-paste build prompt per gap: **`docs/pricing-page-feature-prompts.md`** (2026-07-12). Already built and verified during the audit: self-service portal, PWA, scheduling & hour tracking, standard reporting + CSV export, email notifications, advanced scheduling & approvals, logo branding, geofenced clock-in, multi-location.

Suggested order (dependency-driven; details and rationale in the prompts doc): F1 → F2 → F4 → F3 → F8 → F7 → F6 → F5 → F9 → F12 → F13 → F16 → F10 → F11; F14–F15 any time.

- [ ] **F1. `[opus]` Plan tiers, limits & feature gating** — `web/lib/plan.ts`, org `plan` column, cap enforcement. Prompt 1. *Blocks nearly everything below.*
- [ ] **F2. `[opus]` Stripe billing & subscriptions** — checkout, portal, webhook → plan sync. Prompt 2.
- [ ] **F3. `[sonnet]` Industry templates (1/3/all by tier)** — template bundles + Settings applier. Prompt 3.
- [ ] **F4. `[sonnet]` SMS integration + monthly quota** — Twilio behind `web/lib/sms.ts`; channel exists in UI but is unwired. Prompt 4.
- [ ] **F5. `[sonnet]` Background check provider integration** (Checkr) — tracking exists, integration doesn't. Prompt 5.
- [ ] **F6. `[sonnet]` Kiosk mode** — shared-device check-in at `/kiosk`, PIN + token sessions. Prompt 6.
- [ ] **F7. `[sonnet]` Public API + data exports** — `/api/v1/*`, API keys, server-side CSV. Prompt 7.
- [ ] **F8. `[opus]` Advanced permissions (roles)** — owner/admin/coordinator/viewer on `admin_users`; keep `requireAdmin()` behavior intact. Prompt 8.
- [ ] **F9. `[sonnet]` Full white-label branding** — colors, app name, dynamic manifest, branded email, hide-Envolv toggle. Prompt 9.
- [ ] **F10. `[opus]` Multi-org & network dashboard** — split into 3 Notion tasks (org-resolution refactor / memberships + switcher / network page). Prompt 10.
- [ ] **F11. `[opus]` SSO / SAML** via Supabase Auth SSO. ⛔ Requires Supabase Pro+ — Sean decides on plan upgrade first. Prompt 11.
- [ ] **F12. `[sonnet]` CSV import, competitor importers, outbound webhooks.** Prompt 12.
- [ ] **F13. `[sonnet]` In-app support widget + plan-aware SLA routing.** Prompt 13.
- [ ] **F14. Support SLA & CSM playbook** (`docs/support-playbook.md`) — document only. Prompt 14.
- [ ] **F15. Security review pack & DPA drafts** (`docs/security-overview.md`, `docs/dpa-template.md`, questionnaire crib sheet) — documents; DPA needs attorney review ⛔. Prompt 15.
- [ ] **F16. `[sonnet]` Data retention & deletion** — org delete with grace window, volunteer anonymization, audit log. Prompt 16.

Pipeline note: each F-task that goes to the nightly agent needs its prompt pasted into the Notion `Component/File` field (never blank — see CLAUDE.md), and F1–F12 add migrations, so review agent SQL before merging (`supabase-migrate.yml` auto-applies on merge).

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
