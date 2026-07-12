# Demo Environment — Separate Vercel Project

**Created:** 2026-07-11
**Why:** Isolation by construction. The Preview-scoping approach put a demo build on the **live clinic database** (confirmed: the `demo` preview inlined `vopgctgjxbpytntthoxb`). A separate Vercel project has its own environment variables — no shared scoping to misconfigure, so no checkbox mistake can ever point a demo at Yakima's real data.

## Target end state

| | Project `medvolunteer` | Project `envolv-demo` (new) |
|---|---|---|
| Git branch | `main` | `demo` |
| URL | `medvolunteer.vercel.app` | `envolv-demo.vercel.app` |
| Supabase | `vopgctgjxbpytntthoxb` (Yakima prod) | `cquvutwulbtgklqrbamd` (demo, 14 fake volunteers) |
| Data | Real clinic data | Fake seed data |
| Email | Resend live | **none** (fails loudly — safer) |

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

Then **Settings → Git → Production Branch → `demo`**.

That last one is the trick: `demo` becomes this project's *production* branch, so it gets a stable URL (`envolv-demo.vercel.app`) instead of a rotating preview hash.

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

Now the production project builds *only* `main`. It can never again produce a preview deployment carrying production credentials — which is exactly what bit us today. The `demo` branch is handled solely by `envolv-demo`.

---

## Step 5 — Verify

1. `envolv-demo.vercel.app/login` → sign in → dashboard shows **14 volunteers, 6 shifts**. If it's empty, it's pointed at prod — stop and recheck Step 2.
2. `medvolunteer.vercel.app` → still the real clinic, still empty. Untouched.
3. Push a throwaway branch → confirm the `medvolunteer` project does **not** build it.

---

## Standing rule

**`main` → real clinic data. `demo` → fake data. Never demo off `main`.**

Two projects, two databases, two URLs, no shared configuration. The separation is now structural rather than a checkbox someone has to remember.
