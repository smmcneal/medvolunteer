# Envolv — Project Status & Back-on-Track Plan
*Compiled 2026-07-06 from repo, Vercel, Notion, business plan, and founders agreement.*

## Where things actually stand

### 1. Yakima Free Clinic site — deployed as client preview, not production-cut-over
- Live at **medvolunteer.vercel.app**, branded "Yakima Free Clinic". Latest production deploy is READY (built from the Apr 29 commit `c88af36 "complete phase 9 deployment prep"`).
- All three tracked bugs (DEV-00007/8/9) are fixed and merged to main. The remote fix branches are stale leftovers — safe to delete.
- Roadmap phases 0–8.5 complete. **Phase 9 remainder is the gap**: production Supabase hardening (migrations + 7 edge functions on a prod project), Auth Site URL / redirect URLs, first admin account, VAPID keys in org settings, RLS verification.
- Phase 10 in the roadmap targets **SiteGround** — obsolete. The project actually deployed via Vercel (per `docs/superpowers/plans/2026-03-20-vercel-deploy-client-preview.md`). No custom domain is attached; only *.vercel.app domains.
- **No commits since Apr 29 (9+ weeks idle).**

### 2. Umbrella site / Envolv platform — does not exist yet
- **envolv.app and envolv.org resolve but serve empty pages.** No Vercel project exists for them (the team has exactly one project: medvolunteer).
- A multi-tenant platform plan exists: `docs/superpowers/plans/2026-03-21-volunteerhub-phase-1-foundation.md` — a new Next.js 15 repo with path-based multi-tenancy (`/[orgSlug]/`), vertical config registry (medical, animal shelter, food bank, nonprofit), planned at `C:/Users/smmcn/Desktop/volunteerhub`. That folder isn't in this workspace, so whether it was ever scaffolded is unconfirmed.
- The plan predates the Envolv name (and "VolunteerHub" is an existing competitor's trademark — rename regardless).

### 3. Automation pipeline — stalled by an empty backlog
- The nightly auto-build CI only picks up Notion Feature Requests marked **"Ready"**. The Feature Requests DB contains just two empty stubs ("Email list", "Accept Donations"), both status "New", no descriptions. The agent has had nothing to build since March.
- Notion MCP is on a free plan — row queries via API are blocked (search/fetch still work).
- `.mex/ROUTER.md` referenced in CLAUDE.md does not exist — the memory submodule was never initialized. Remove the reference or init the submodule.

### 4. Business side (business plan Mar 2026 + founders agreement Apr 9, 2026)
- Envolv, LLC (NC), 3 founders at 33.33%, 4-yr vesting / 1-yr cliff, no Year-1 salaries, 5-year commitment.
- **§5.1: initial capital contributions ($8–10k each) were to be finalized within 30 days of the Apr 9 signing — that window closed ~May 9.** Confirm this happened.
- Business plan next steps scorecard: ① LLC formed ✅ ② 20+ customer discovery interviews — status unknown ③ multi-tenant adaptation — planned, not confirmed started ④ marketing website — **not done** ⑤ Asheville-area closed beta — not started.

## Back-on-track plan (recommended order)

1. **Finish the Yakima cutover (1–2 sessions).** Work the unchecked Phase 9 boxes; replace obsolete Phase 10 with a Vercel checklist: attach a real domain (e.g. `yakima.envolv.app` or the clinic's domain), verify auth links/push/geofence clock-in on the prod domain, smoke test, client sign-off. This produces the referenceable first customer.
2. **Ship a minimal envolv.app marketing site (1 session).** The domains are paid for and serving nothing. One-page landing from the business plan positioning + pricing tiers ($29/$79/$199), demo-request email capture — this also unblocks business-plan step ④ and the "Email list" feature stub.
3. **Locate or restart the umbrella platform repo.** If `Desktop/volunteerhub` exists, rename to envolv and resume Phase 1; if not, re-run the Phase 1 foundation plan under the Envolv name. This is the actual SaaS product; medvolunteer becomes the medical vertical config.
4. **Restart the pipeline.** Populate Notion Feature Requests with a real backlog and mark items "Ready" so the nightly agent resumes; delete merged branches; update `MedVolunteer-roadmap.txt`; fix the `.mex` reference in CLAUDE.md.
5. **Close business loops.** Confirm §5.1 capital contributions, log customer-discovery progress, and build the Asheville beta prospect list (per §3.1, new verticals must be in the strategic plan before entry).

## Sources
- Repo: git log/branches, `MedVolunteer-roadmap.txt`, `docs/superpowers/plans/*`, `volunteer-saas-business-plan.pdf` (untracked, repo root)
- Vercel: team `medvol` → project `medvolunteer` (latest prod deployment READY, no custom domains)
- Notion: [Feature Requests DB](https://app.notion.com/p/3293cc8e26b6806992a9c26d9d293a37)
- Uploaded: Envolv_Founders_Agreement.pdf
