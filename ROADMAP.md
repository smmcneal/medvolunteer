# Envolv Roadmap & Agent Task List
*Written 2026-07-06. Supersedes Phases 9–10 of `MedVolunteer-roadmap.txt` (SiteGround plan is obsolete — we deploy on Vercel).*
*Context docs: `docs/ENVOLV-STATUS-2026-07-06.md` (full status assessment) and `docs/yakima-production-cutover.md` (cutover runbook).*

## For the agent reading this

- Read `CLAUDE.md` first and follow its conventions exactly (admin client rules, page+view pattern, i18n hooks, branch naming `feat/DEV-###-slug`). **Exception: ignore the `.mex/` instructions — that submodule was never initialized and `.mex/ROUTER.md` does not exist.**
- Work one task at a time, in order within a workstream. Check the box, commit with a conventional message, and stop at any ⛔ item — those need Sean (credentials, DNS, client contact, or a business decision).
- Model routing: **Opus** for tasks tagged `[opus]` (architecture, multi-repo, ambiguous scope). **Sonnet** for `[sonnet]` (well-scoped implementation). Untagged = either.
- There is no test suite. Verify with `npm run build` + `npm run lint` from `web/`, and manual checks via the dev auto-login routes in CLAUDE.md.

## The big picture

Envolv, LLC is launching a multi-industry volunteer management SaaS (business plan: `volunteer-saas-business-plan.pdf`, repo root). Three deliverables, in priority order:

1. **Yakima Free Clinic** (this repo) — first client, single-tenant, live as a preview at medvolunteer.vercel.app. Needs production cutover.
2. **envolv.app marketing site** — owned domains currently serve empty pages. Needs a landing page.
3. **Envolv multi-tenant platform** — separate repo at `C:/Users/smmcn/Desktop/volunteerhub`. The real SaaS product; this repo becomes its medical vertical.

---

## Workstream A — Yakima production cutover 🔴 do first

Detailed commands in `docs/yakima-production-cutover.md`.

- [ ] ⛔ **A1. Decisions from Sean:** fresh vs. reused Supabase prod project; domain choice (`yakima.envolv.app` recommended); Supabase access token; DNS host login; Resend verification for envolv.org; Yakima sign-off contact.
- [x] **A2. `[sonnet]` Reconcile edge functions.** ✅ 2026-07-08 — real count is **7** (advance-onboarding, background-check-webhook, clock-in, clock-out, initiate-background-check, send-message, send-push). The "8" was stale design intent: `MedVolunteer-roadmap.txt` planned a `docusign-webhook` that was never built (Phase 0 shipped 6, Phase 8 added send-push). E-signature is handled via the `documents.provider` column, not an edge function. Fixed the "8" in `ENVOLV-STATUS` + old roadmap; nothing is missing. Minor follow-up for A3: `send-push` lacks a `config.toml` block but deploys fine.
- [ ] **A3. `[sonnet]` Production Supabase setup** (after A1): `supabase link` → `db push` (25 migrations) → `functions deploy` → `secrets set`. Acceptance: all migrations applied, functions responding, no demo seed run.
- [ ] **A4. `[sonnet]` Auth + env cutover:** Supabase Auth Site URL/redirect URLs to prod domain; Vercel prod env vars repointed; redeploy. Acceptance: magic-link invite works end-to-end on prod domain.
- [ ] **A5. `[sonnet]` First real data:** Yakima org row, first admin auth user + `volunteers` row (`status='active'`), VAPID keys set in Settings → Web Push.
- [ ] **A6. Smoke test** — full checklist in the runbook (logins, PWA install, offline page, push, geofence clock-in, cron auth, Lighthouse ≥ 90). Acceptance: every box checked on the production domain.
- [ ] ⛔ **A7. Client sign-off** with Yakima; deliver credentials securely.

## Workstream B — envolv.app marketing site 🟡 second

- [ ] **B1. `[opus]` Scaffold the site.** New Next.js project (separate repo `envolv-www` or `/marketing` app in volunteerhub repo — decide and document). One-page landing: positioning from the business plan (mobile-first, industry templates, undercuts Volgistics), pricing tiers ($29 Starter / $79 Professional / $199 Enterprise, ~17% annual discount), demo-request email capture (Resend, `noreply@envolv.org`). Acceptance: builds clean, deploys to a new Vercel project.
- [ ] ⛔ **B2. DNS:** point envolv.app (+ www, and envolv.org redirect → envolv.app) at the Vercel project.
- [ ] **B3. `[sonnet]` Email capture backend:** store signups (Supabase table or Resend audience) — this also closes the "Email list" stub in the Notion Feature Requests DB.
- [ ] **B4. `[sonnet]` SEO basics:** metadata, OG image, robots.txt, sitemap. Acceptance: Lighthouse SEO ≥ 95.

## Workstream C — Envolv multi-tenant platform 🟢 third

Repo: `C:/Users/smmcn/Desktop/volunteerhub` (exists; not yet assessed). Plan: `docs/superpowers/plans/2026-03-21-volunteerhub-phase-1-foundation.md`.

- [ ] **C1. `[opus]` Assess actual state** of the volunteerhub repo vs. the Phase 1 plan (scaffold, `[orgSlug]` routing, verticals registry, Supabase schema). Output: gap list appended to this file.
- [ ] **C2. `[sonnet]` Rename VolunteerHub → Envolv** everywhere (VolunteerHub is a competitor's trademark). Repo folder, package name, UI strings, plan docs.
- [ ] **C3. `[opus]` Complete Phase 1 foundation** per the plan: multi-tenant path routing, vertical configs (medical, animal-shelter, food-bank, nonprofit), OrgProvider, RLS. Acceptance: two seed orgs render branded dashboards with correct vertical labels; Vitest unit tests pass.
- [ ] **C4. `[opus]` Migration strategy doc:** how medvolunteer's features (shifts, onboarding, LMS, messages, PWA) port into the multi-tenant architecture, and what happens to the Yakima instance (stays standalone vs. migrates to `yakima` org slug). Decision needed from Sean before implementation. ⛔
- [ ] ⚖️ Note: founders agreement §3.1 — entering a vertical not in the strategic plan requires unanimous founder consent. Stick to the four planned verticals.

## Workstream D — Pipeline & housekeeping (parallel, any time)

- [ ] **D1. `[sonnet]` Delete merged remote branches:** `fix/DEV-00007..9` (all merged to main), stale `vercel/*` and `claude/*` branches after confirming merged/abandoned.
- [ ] **D2. `[sonnet]` Fix CLAUDE.md:** remove the `.mex/` navigation section (submodule never initialized); add a pointer to this ROADMAP.md.
- [ ] **D3. `[sonnet]` Archive `MedVolunteer-roadmap.txt`** phases 9–10 with a note pointing here.
- [ ] ⛔ **D4. Populate Notion Feature Requests** with a real backlog and mark items "Ready" — the nightly auto-build CI only picks up "Ready" tasks and has been idle since March. (Sean writes/approves; an agent can draft entries.)
- [ ] **D5. `[sonnet]` Commit or remove untracked PDFs** in repo root (business plan, projections, targeting strategy) — decide if they belong in git (they're marked CONFIDENTIAL; likely move out of the repo). ⛔ Sean decides.

## Workstream E — Business (Sean only, not for agents)

- [ ] Confirm §5.1 capital contributions were finalized (30-day window closed ~May 9).
- [ ] Customer discovery: 20+ interviews across 3–4 t