# Demo Environment — Separate Vercel Project

**Created:** 2026-07-11
**Updated:** 2026-07-12 — **the demo no longer has its own branch. Both projects track `main`.**
**Why:** Isolation by construction. The Preview-scoping approach put a demo build on the **live clinic database** (confirmed: the `demo` preview inlined `vopgctgjxbpytntthoxb`). A separate Vercel project has its own environment variables — no shared scoping to misconfigure, so no checkbox mistake can ever point a demo at Yakima's real data.

## Target end state

| | Project `medvolunteer` | Project `envolv-demo` |
|---|---|---|
| Git branch | `main` | `main` |
| URL | `medvolunteer.vercel.app` | `envolv-demo.vercel.app` |
| Supabase | `vopgctgjxbpytntthoxb` (Yakima prod) | `cquvutwulbtgklqrbamd` (demo, 14 fake volunteers) |
| Data | Real clinic data | Fake seed data |
| Email | Resend live | **none** (fails loudly — safer) |

## Why both projects build `main` (changed 2026-07-12)

The demo originally had its own `demo` branch, purely so the project had a production branch of its own and therefore a stable URL. That branch was never merged forward, and by 2026-07-12 the demo was **17 commits behind `main`** — serving a July 11 build while every AB-000xx feature shipped to prod. Sales demos were showing stale software.

The branch was doing no work: **data isolation lives in the Vercel project's environment variables, not in the branch.** So `envolv-demo`'s Production Branch is now `main` (Settings → Environments → Production → Branch Tracking). Every push to `main` produces two production deployments — `medvolunteer` with prod env vars, `envolv-demo` with demo env vars — and the demo cannot drift again.

The `demo` branch is deleted. **Do not recreate it.** If the demo ever needs different *code* (not just different data), that is a product decision, not a deploy-config one — raise it before branching.

---

## Step 0 — Delete the accidental duplicate

Vercel → project **`medvolunteer-5wjx`** → Settings → scroll to bottom → **Delete Project**.

It's a duplicate connected to the same repo, framework never set, rebuilding every commit. Nothing depends on it. Confirm the name at the top of the settings page is `medvolunteer-5wjx` — **not** `medvolunteer` — before you delete.

---

## Step 1 — Create the demo project

Vercel → **Add New → Project** → import `smmcneal/medvolunteer` (the same repo — this is fine and intended).

Configure **before** the first deploy:

| Setting | Value |
|---|---|
| Project Name | `envolv-demo` |
| Framework Preset | **Next.js** (do not leave on auto — this is what drifted to NestJS last time) |
| Root Directory | **`web`** |

Then **Settings → Environments → Production → Branch Tracking → `main`**.

That gives the project a stable production URL (`envolv-demo.vercel.app`) fed by the same branch prod builds from — the demo is then always the current software, just against the fake database.

*(Historical: this originally said `demo`. See "Why both projects build `main`" above.)*

---

## Step 2 — Environment variables (all scoped to Production)

Values come from Supabase → project **`cquvutwulbtgklqrbamd`** → Settings → API.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://cquvutwulbtgklqrbamd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | demo project's anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | demo project's service_role key |
| `CRON_SECRET` | any random string |

**Deliberately leave out `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.** Without them the demo cannot send email — messaging will fail visibly instead of quietly mailing real people from a fake dataset. That's the failure mode you want.

Double-check every value starts with or contains `cquvut`, not `vopgct`. That single check is the whole point of this exercise.

---

## Step 3 — Supabase Auth URLs for the demo project

Supabase → `cquvutwulbtgklqrbamd` → Authentication → URL Configuration:

- **Site URL:** `https://envolv-demo.vercel.app`
- **Redirect URLs:** add `https://envolv-demo.vercel.app/auth/callback`

Your three admin accounts already exist on this project, so login works immediately.

---

## Step 4 — Stop the prod project from building preview branches

This closes the hole permanently. In project **`medvolunteer`** → Settings → Git → **Ignored Build Step**:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" == "main" ]; then exit 1; else exit 0; fi
```

(Vercel semantics: exit **1** = build, exit **0** = skip.)

**✅ Applied 2026-07-12.** Vercel now ships this as a first-class option, so the hand-rolled script above is no longer needed. Use **Settings → Build and Deployment → Ignored Build Step → Behavior: `Only build production`**, which fills in:

```bash
if [ "$VERCEL_ENV" == "production" ]; then exit 1; else exit 0; fi
```

Now the production project builds *only* production (i.e. `main`) — it can no longer produce a preview deployment carrying production credentials, which is exactly what bit us. Feature-branch previews are still built by `envolv-demo` against the fake DB, which is where you want to review a PR anyway.

(Until 2026-07-12 this step had never actually been applied — `medvolunteer` was observed building `feat/AB-*` previews with prod env vars.)

---

## Step 5 — Verify

1. `envolv-demo.vercel.app/login` → sign in → dashboard shows **14 volunteers, 6 shifts**. If it's empty, it's pointed at prod — stop and recheck Step 2.
2. `medvolunteer.vercel.app` → still the real clinic. Untouched.
3. Decode the demo bundle and confirm it resolves to `cquvut…` and contains **no** `vopgct…`. The dashboard cannot be trusted for this — Vercel masks Sensitive values. Load `envolv-demo.vercel.app/login` and grep every loaded `.js` chunk for the two project refs.

---

## Standing rule

**Same code, different data. Both projects build `main`; the database comes from the project's env vars.**

`medvolunteer` → real clinic data. `envolv-demo` → fake data. The demo is always current by construction, and no branch has to be remembered or merged forward.
