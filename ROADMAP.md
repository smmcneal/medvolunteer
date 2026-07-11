# Envolv Roadmap & Agent Task List
*Originally written 2026-07-06. Updated 2026-07-10 (dummy data restored; Supabase + Vercel connectors in place; housekeeping pass).*
*Supersedes Phases 9–10 of `MedVolunteer-roadmap.txt` (SiteGround plan is obsolete — we deploy on Vercel).*
*Context docs: `docs/ENVOLV-STATUS-2026-07-06.md` (full status assessment) and `docs/yakima-production-cutover.md` (cutover runbook).*

## Current status (2026-07-10)

- **Preview app is live and healthy** on Vercel (`medvolunteer.vercel.app`; project `medvolunteer`, team `medvolreview`). Latest production deploy is READY.
- **Dummy data is restored** in the preview Supabase project (`cquvutwulbtgklqrbamd`): `seed-demo.sql` (14 volunteers, shifts, hours, credentials, messages) is now wired into `supabase/config.toml` and loads on `db reset`.
- **Supabase + Vercel connectors are in place.** This unblocks the Yakima production cutover (Workstream A), which was waiting on Supabase access — A3/A4/A5 can now be driven largely through the connectors.
- **Housekeeping pass done 2026-07-10** (this update): ROADMAP rewritten as a prioritized list; `.mex/` references removed from `CLAUDE.md` (D2); `MedVolunteer-roadmap.txt` archived (D3). These changes sit in the working tree, **not yet committed or pushed** — this sandbox has no GitHub push credentials. See Workstream D for the push + branch-delete commands to run from your machine.
- **Before real data goes into prod:** run the pre-cutover DB hardening items from the Supabase advisors — see the section at the bottom.

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
- [ ] **A3. `[sonnet]` Production Supabase setup** (after A1): create the fresh prod project → apply all migrations → deploy the 7 edge functions → set secrets. Drive via the Supabase connector where possible. Acceptance: all migrations applied, functions responding, **no demo seed run** (dummy data stays in the preview project).
- [ ] **A3.5 `[sonnet]` Pre-cutover DB hardening** (fold into a migration so it carries into prod): set `search_path` on the 2 flagged functions; enable Auth leaked-password protection; review/revoke `anon` + `authenticated` SELECT on admin-only tables (39 exposed via the auto GraphQL/PostgREST schema); confirm the volunteer-facing tables the PWA reads have the RLS policies they need. Full detail in "Pre-cutover DB hardening" below.
- [ ] **A4. `[sonnet]` Auth + env cutover:** Supabase Auth Site URL/redirect URLs → `yakima.envolv.app`; Vercel prod env vars repointed; redeploy. Acceptance: magic-link invite works end-to-end on the prod domain.
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

- [ ] **D1. Push this housekeeping + delete the merged remote branches.** Must run from a machine with GitHub push credentials (the Cowork sandbox has none). Local `main` has diverged from `origin/main` (upstream added a security/RLS lockdown + a lint pass), so integrate before pushing:

  ```bash
  # from the repo root:
  git add CLAUDE.md ROADMAP.md MedVolunteer-roadmap.txt supabase/config.toml
  git commit -m "docs: roadmap/CLAUDE housekeeping; wire demo seed into config"
  git fetch origin
  git rebase origin/main       # resolve conflicts in CLAUDE.md, MedVolunteer-roadmap.txt, supabase/config.toml
  git push origin main

  # delete the 5 confirmed-merged branches:
  git push origin --delete \
    fix/DEV-00007-messages-individual-search-provides-no-results \
    fix/DEV-00008-category-requirements-don-t-auto-update \
    fix/DEV-00009-volunteer-signed-up-for-incorrect-category-shift \
    vercel/install-vercel-speed-insights-8t4nmw \
    vercel/install-vercel-web-analytics-cb39c4
  ```

  Leave `vercel/install-vercel-web-analytics-h9gqg7` and `claude/add-claude-documentation-Oaavt` — both are **unmerged** (each has a commit not in `main`).
- [x] **D2. Fix `CLAUDE.md`** — removed the dead `.mex/` navigation and "After Every Task" sections (the submodule was never initialized) and pointed the file at this ROADMAP. ✅ 2026-07-10
- [x] **D3. Archive `MedVolunteer-roadmap.txt`** — added a superseded banner and flagged Phases 9–10 as obsolete (SiteGround → Vercel). ✅ 2026-07-10
- [ ] ⛔ **D4. Populate Notion Feature Requests** with a real backlog and mark items "Ready" — the nightly auto-build CI only picks up "Ready" tasks and has been idle since March. (Sean writes/approves; an agent can draft entries.)
- [ ] ⛔ **D5. Commit or remove the untracked PDFs** in the repo root (business plan, projections, targeting strategy) — they're marked CONFIDENTIAL and likely belong outside the repo. Sean decides.

## Workstream E — Business (Sean only, not for agents)

- [ ] Confirm §5.1 capital contributions were finalized (30-day window closed ~May 9).
- [ ] Customer discovery: 20+ interviews across 3–4 target verticals.

## Pre-cutover DB hardening

Run these before any real data goes into the production project — fold them into a migration where possible so they carry into prod. Sourced from the Supabase advisors on the preview project (`cquvutwulbtgklqrbamd`):

- [ ] Set an explicit `search_path` on the 2 flagged functions (mutable `search_path` warning).
- [ ] Enable Auth leaked-password protection (HaveIBeenPwned check) in the Auth settings.
- [ ] Review and revoke `anon` + `authenticated` SELECT on admin-only tables — 39 are exposed via the auto-generated GraphQL/PostgREST schema.
- [ ] Confirm the volunteer-facing tables the PWA reads still have the RLS policies they need, so tightening the above doesn't break the volunteer app.
