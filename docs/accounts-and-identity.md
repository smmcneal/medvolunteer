# Envolv — Account Registry & Identity Migration Plan

**Written 2026-07-12. Plan only — nothing in this document has been executed.**

The problem: services were signed up under legacy names (**Volist**, **VolunteerHub**, **medvol**) and under Sean's personal identities. Envolv is a 3-founder LLC. Today, no co-founder but Sean can log into anything, and the names don't match the company.

**Decision (Sean, 2026-07-12):** the single login identity for every Envolv service becomes **`ops@envolv.app`**, served by Namecheap's free email forwarding (already configured — see §1).

---

## 0. What I verified vs. what you need to confirm

Everything in the "Verified" column below I read directly from the live service or the repo. The **account each service is billed/owned under is not exposed by any API** — you'll need to confirm those by logging in. Those cells say **`CONFIRM`**.

| Fact | How verified |
|---|---|
| Supabase org `Volist` (`yqowwdbfzmwyavdyqows`), free plan, 2 projects | Supabase connector, `list_organizations` / `list_projects` |
| Vercel team `medvol` (slug `medvolreview`, `team_fcXlGpnomwRavkmV24hh59AV`), 2 projects | Vercel connector, `list_teams` / `list_projects` |
| GitHub repo is `smmcneal/medvolunteer` — a **personal** repo, not an org | `.git/config` remote |
| Resend has **zero verified domains** and one default API key ("Onboarding", created 2026-07-10) | Resend connector, `list-domains` / `list-api-keys` |
| Notion workspace member: Sean `<smmcneal@gmail.com>`, free plan | Notion connector, `get-users` |
| **Both domains are registered at Namecheap** | Live DNS: `envolv.app` + `envolv.org` NS = `dns1/dns2.registrar-servers.com` |
| `envolv.app` already has Namecheap **email forwarding** live (MX `eforward1-5.registrar-servers.com`, SPF `include:spf.efwd.registrar-servers.com`) | Live DNS MX/TXT |
| `envolv.org` points at `162.255.119.120` (a Namecheap parking page) and has **no MX and no SPF** | Live DNS |
| Checkr / Twilio / DocuSign accounts **do not exist** — code paths are stubs | grep: only roadmap mentions + `[STUB]` no-op branches |

---

## 1. The Namecheap discovery — this closes two open blockers

`ROADMAP.md` A1 and `docs/yakima-production-cutover.md` both list **"envolv.app DNS host login"** as an unresolved ⛔ blocker. It isn't unknown anymore:

> **Both `envolv.app` and `envolv.org` are on Namecheap BasicDNS.** The DNS host login is a Namecheap account login. `CONFIRM` which email that account is under.

Two consequences:

1. **`ops@envolv.app` is free and available today.** Namecheap's email forwarding MX records are *already published* on `envolv.app`. You add the alias in the Namecheap dashboard (Domain List → Manage → Advanced DNS / Redirect Email) and it forwards to whatever inbox you name — no new spend, no Google Workspace. It is **receive-only**, which is all a login identity needs (signup confirmation, password reset, billing notices). It cannot *send*; outbound app mail is Resend's job (§4).
2. **The `yakima.envolv.app` CNAME is unblocked** whenever you decide to do it. (Still deferred by your 2026-07-11 call — noted, not reopening it.)

---

## 2. Master account registry

Legend for **Port difficulty**: 🟢 trivial · 🟡 an afternoon, with a checklist · 🔴 painful, avoid.

| # | Service | Current name | Logged in under | Holds | Target name | Port difficulty |
|---|---|---|---|---|---|---|
| 1 | **Namecheap** | — | `CONFIRM` | `envolv.app`, `envolv.org`, all DNS, email forwarding | keep; change account email | 🟢 **Don't transfer registrar.** Change the Namecheap account's email to `ops@envolv.app`, turn on 2FA. Registrar transfers have a 60-day lock and buy you nothing. |
| 2 | **GitHub** | `smmcneal/medvolunteer` (personal) | `smmcneal` (id 29557444) | the repo, Actions, all CI secrets | **org `envolv`**, repo `envolv/medvolunteer` | 🟡 See §3 — easy transfer, but **secrets do not come with it** |
| 3 | **Vercel** | team `medvol` / slug `medvolreview` | `CONFIRM` | projects `medvolunteer`, `envolv-demo` | team `envolv` | 🟢 **Rename the team, don't migrate it.** Team rename is a settings field and breaks nothing. |
| 4 | **Supabase** | org **`Volist`** (free) | `CONFIRM` | `Volistapp's Project` (demo, `cquvutwulbtgklqrbamd`), `Envolv Yakima (prod)` (`vopgctgjxbpytntthoxb`) | org **`Envolv`** | 🟢 to rename · 🔴 to actually move projects — see §5 |
| 5 | **Resend** | — | `CONFIRM` | 1 default API key, **0 domains** | recreate under `ops@envolv.app` | 🟢 **Nothing to preserve — just recreate.** See §4, this is also a live production bug. |
| 6 | **Notion** | Sean's workspace (free) | `smmcneal@gmail.com` | Dev Tasks & QA DB, Feature Requests DB, the integration token | add `ops@envolv.app` as admin | 🟡 See §6 — invite-then-promote, don't rebuild |
| 7 | **Anthropic / Claude** | — | Sean's personal subscription | `CLAUDE_CODE_OAUTH_TOKEN` (powers both nightly agents) | business decision | 🟡 See §7 |
| 8 | **Checkr** | *does not exist* | — | — | create under `ops@envolv.app` | 🟢 greenfield |
| 9 | **Twilio** | *does not exist* | — | — | create under `ops@envolv.app` | 🟢 greenfield |
| 10 | **DocuSign** | *does not exist* | — | — | create under `ops@envolv.app` | 🟢 greenfield |

### Not accounts — secrets. Listed so nothing is forgotten during a move.

`SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_ACCESS_TOKEN` · `SUPABASE_PROJECT_ID` · `SUPABASE_DB_PASSWORD` (prod's is **auto-generated and unknown — must be reset in the dashboard**) · `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + VAPID private key · `CRON_SECRET` (must match in **three** places: Vercel env, `.env.local`, GitHub Secrets) · `VERCEL_WEBHOOK_SECRET` · `GH_PAT` · `APP_URL` · `NOTION_TOKEN` · `NOTION_DEV_TASKS_DB_ID` · `NOTION_FEATURE_REQUESTS_DB_ID` · `RESEND_API_KEY` · `RESEND_FROM_EMAIL`

### Repos, for completeness

| Repo | Location | On GitHub? |
|---|---|---|
| `medvolunteer` | `C:\Users\smmcn\Projects\medvolunteer` | yes — `smmcneal/medvolunteer` |
| `envolv-www` | `C:\Users\smmcn\Projects\envolv-www` | `CONFIRM` — created 2026-07-12 per ROADMAP B1; not mounted, couldn't check |
| `volunteerhub` | `C:\Users\smmcn\Desktop\volunteerhub` | `CONFIRM` — not mounted. **Rename before pushing anywhere public: VolunteerHub is a competitor's trademark** (ROADMAP C2). |

---

## 3. GitHub — do this one first

Everything else references the repo, so the org move goes first.

**Path:** create a free GitHub Organization named `envolv` → GitHub's native *Settings → Transfer ownership* on `smmcneal/medvolunteer`. Transfer preserves issues, PRs, branches, and installs a redirect from the old URL, so **existing clones and `git remote`s keep working** — including `.claude/git-push.bat`.

**The trap:** transferring a repo **does not carry Actions secrets across.** The nightly agents and the cron will go silently green-but-broken (`auto-fix-bugs.yml` already has a documented history of failing while reporting success). Re-add, then verify each:

- `NOTION_TOKEN`, `NOTION_DEV_TASKS_DB_ID`, `NOTION_FEATURE_REQUESTS_DB_ID`
- `CLAUDE_CODE_OAUTH_TOKEN`, `GH_PAT`
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`
- `CRON_SECRET` (must equal the Vercel value), `APP_URL` (no trailing slash)

Also re-authorize the **Vercel ↔ GitHub integration** against the new org, or deploys stop, and re-mint `GH_PAT` with org scope.

**Add both co-founders as org owners.** This is the single highest-value item in the document — right now the entire codebase sits in one person's personal namespace.

---

## 4. Resend — this is a live production bug, not just hygiene

Resend reports **zero verified domains**. Meanwhile:

- `docs/yakima-production-cutover.md` and `.env.example` both specify `RESEND_FROM_EMAIL=noreply@envolv.org`
- `web/.env.local` currently has `RESEND_FROM_EMAIL=onboarding@resend.dev`

`onboarding@resend.dev` **only delivers to the Resend account owner's own address.** Any volunteer invite sent today goes nowhere. And `noreply@envolv.org` would 403, because the domain was never verified. Either way, **outbound email is non-functional right now.**

Fix (30 minutes, and it doesn't depend on the identity migration):

1. Resend → Domains → Add `envolv.org`.
2. Paste the three records Resend gives you (DKIM `CNAME`, SPF `TXT`, DMARC `TXT`) into **Namecheap → Advanced DNS** for `envolv.org`. Note `envolv.org` currently has **no MX and no SPF at all**, so there's nothing to conflict with.
3. Verify in Resend, set `RESEND_FROM_EMAIL=noreply@envolv.org` in Vercel, **redeploy**.

Because Resend holds nothing worth keeping (one unused key, no domains, no contacts), **do not migrate it — recreate the account under `ops@envolv.app`** and re-add the domain there. Cost of recreation: zero.

> ⚠️ `RESEND_API_KEY` is a plain env var, not `NEXT_PUBLIC_*`, so it does **not** need a rebuild — but `NEXT_PUBLIC_SITE_URL` does. Per `CLAUDE.md`, `NEXT_PUBLIC_*` vars are inlined at build time; changing one in Vercel does nothing until you redeploy. This already caused a production login outage on 2026-07-11.

---

## 5. Supabase — rename the org, do **not** move the projects

**Rename is free and safe.** `Volist` → `Envolv`, and `Volistapp's Project` → `Envolv Demo`. Neither rename changes the project **ref** (`cquvutwulbtgklqrbamd`, `vopgctgjxbpytntthoxb`) — refs are immutable and are what's baked into `NEXT_PUBLIC_SUPABASE_URL`. So renaming touches **nothing** in code, env vars, or CI. Do it whenever.

**Moving the projects to a different Supabase account is the one genuinely 🔴 item here, and it's avoidable.** There's no clean free-tier project transfer; doing it by hand means, per project: `pg_dump`/restore → rotate anon + service-role + JWT keys → redeploy all **7 edge functions** → re-set every function secret → update Vercel env → redeploy → reconcile `supabase_migrations.schema_migrations` (which has already bitten this project once — see the `precutover_hardening` note in `CLAUDE.md`). For a *cosmetic* org name, that trade is nonsense.

**So: rename the org, then invite the co-founders as org members.** Same end state, none of the risk.

**Real constraint to plan around, though:** the `Volist` org is on the **free plan, which caps you at 2 active projects — and you have exactly 2.** The multi-tenant platform (Workstream C) will need a third. That forces either a paid org (~$25/mo) or a second free org, and it's a decision you should make deliberately rather than discover at `create_project` time.

---

## 6. Notion — invite, promote, then step back

The two databases are load-bearing: `auto-fix-bugs.yml` and `auto-build-features.yml` read "Ready" tasks from them nightly, and `notion-pr-sync.yml` writes status back.

**Don't rebuild the workspace** — the database IDs are hardcoded into `NOTION_DEV_TASKS_DB_ID` / `NOTION_FEATURE_REQUESTS_DB_ID`, and rebuilding regenerates them. Instead: invite `ops@envolv.app` to the existing workspace, make it an admin, and leave the databases (and their IDs) exactly where they are.

The **integration token** is separate from the workspace. `NOTION_TOKEN` belongs to whoever created the internal integration. Recreate it under the Envolv-owned account, re-share both databases with the new integration, and update the value in **two** places: `web/.env.local` and GitHub Secrets.

Existing constraint, unchanged: the workspace is on the **free plan**, which blocks MCP row queries (use search/fetch).

---

## 7. Anthropic — a business decision, not a migration

`CLAUDE_CODE_OAUTH_TOKEN` authenticates both nightly agents against **Sean's personal Claude subscription quota** — not API credit. Per `CLAUDE.md`, a large `max_tasks` run can exhaust his personal 5-hour usage window. The token also expires roughly a year after minting.

Options, in order of my preference:

1. **Anthropic Team seat under `ops@envolv.app`** — CI stops billing against a founder's personal account, and the token survives Sean going on vacation.
2. Keep the personal subscription, accept the coupling, and re-mint the token annually with `claude setup-token`.
3. Pay-as-you-go `ANTHROPIC_API_KEY` — **but read the warning in `CLAUDE.md` first**: if both the API key and the OAuth token are set, the API key wins, and an empty balance kills every run *while still reporting green*.

---

## 8. Recommended sequence

Each step is independently useful — you can stop after any of them and be better off than you are now.

| Order | Step | Effort | Risk | Unblocks |
|---|---|---|---|---|
| 1 | Locate the **Namecheap** login; enable 2FA; create the `ops@envolv.app` forwarding alias | 20 min | none | everything below, plus the deferred `yakima.envolv.app` CNAME |
| 2 | Stand up a **shared password vault** (1Password/Bitwarden), all 3 co-founders, put every credential in §2 into it | 1 hr | none | the actual problem you asked about |
| 3 | **Verify `envolv.org` in Resend** and fix `RESEND_FROM_EMAIL` (§4) | 30 min | none | **outbound email, which is broken today** |
| 4 | **Supabase renames** `Volist` → `Envolv`, `Volistapp's Project` → `Envolv Demo`; invite co-founders | 10 min | none — refs don't change | the naming confusion |
| 5 | **Vercel team rename** `medvol` → `envolv`; invite co-founders | 10 min | none | the naming confusion |
| 6 | **GitHub org `envolv`** + repo transfer + re-add all 10 Actions secrets + re-auth Vercel integration (§3) | 2 hrs | 🟡 moderate — verify each workflow after | co-founder access to the codebase |
| 7 | Decide the **Anthropic billing identity** (§7) | — | — | CI not depending on one person's personal quota |
| 8 | Decide the **Supabase plan** before Workstream C needs a 3rd project (§5) | — | — | the multi-tenant platform |

**Deliberately *not* on this list:** migrating Supabase projects to a new account, transferring the domain registrar, and renaming the Vercel *project* `medvolunteer`. The first two are 🔴 effort for a cosmetic gain. The third looks harmless but isn't — the project name **is** `medvolunteer.vercel.app`, which `APP_URL` (GitHub Secrets) and `NEXT_PUBLIC_SITE_URL` both point at; renaming it silently 401s every scheduled-message dispatch until both are updated. Let the custom domain do that work instead, at cutover.

---

## 9. Open questions for you

1. **Which email is each of Namecheap / Vercel / Supabase / Resend under?** No API exposes this — log in and check. This is the one gap in the registry.
2. Was `envolv-www` ever pushed to GitHub, and under what namespace? (Not mounted, couldn't verify.)
3. Does `Desktop/volunteerhub` have a git remote? If it's public anywhere under that name, the trademark rename (ROADMAP C2) gets more urgent.
4. `envolv.app` has email forwarding configured — **is an alias already set up on it, and where does it forward?** Worth checking before you add `ops@`.
