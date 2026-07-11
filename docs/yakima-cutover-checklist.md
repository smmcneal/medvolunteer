# Yakima Prod Cutover — Login Fix Checklist

**Created:** 2026-07-11
**Context:** Admin login on `medvolunteer.vercel.app` hangs on "Signing in…" and "Forgot password?" does nothing.

---

## Root cause

Today's deploy (commit `774424e`, 07:17 UTC) was the **first successful production deploy since 2026-04-29** — the Hobby-plan cron limit had been silently blocking every deploy until you fixed it.

That fresh build went out **without `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`**. Verified by pulling all 8 JS chunks from the live `/login` page: the only Supabase-related chunk contains the `@supabase/ssr` "URL and API key are required" guard, but **zero `*.supabase.co` URLs and zero anon keys**.

Because `NEXT_PUBLIC_*` vars are inlined at **build time**, the browser client had `undefined` for both. `createClient()` threw synchronously inside `handleLogin` — before any network call — and with no `try/catch`, `setLoading(false)` never ran. Hence the permanent spinner.

Corroborating: neither Supabase project logged a single auth request today. The request never left the browser.

---

## Step 1 — Set env vars in Vercel (only you can do this)

Vercel → project **medvolunteer** → Settings → Environment Variables. Scope each to **Production** (and Preview, if you want previews working).

Pull the values from Supabase → project **Envolv Yakima (prod)** (`vopgctgjxbpytntthoxb`) → Settings → API.

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vopgctgjxbpytntthoxb.supabase.co` | Safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key | Safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **Secret** — never `NEXT_PUBLIC_` |
| `RESEND_API_KEY` | Resend key | Needed or password-reset emails won't send |
| `RESEND_FROM_EMAIL` | verified sender | |
| `CRON_SECRET` | any strong random string | `/api/cron/*` fails closed without it |
| `VERCEL_WEBHOOK_SECRET` | existing value | |

> **Check the others too.** If the `NEXT_PUBLIC_*` pair went missing, the rest may have been dropped in the same event (likely when the Framework Preset drifted to NestJS). Confirm every var in `web/.env.example` has a Production value.

**Then redeploy.** Env var changes do **not** retroactively apply to an existing build — you must trigger a new deployment for them to be inlined.

---

## Step 2 — Create admin users in Yakima prod

The Yakima DB is fully migrated (all 28 migrations incl. `precutover_hardening`) and seeded — org, 5 categories, onboarding stages, learning modules all present.

But **`auth.users` and `admin_users` are both empty.** Nobody can log in until you add them. Your three admins currently exist only in the *old* project (`cquvutwulbtgklqrbamd`):

- `heatherismith52@gmail.com`
- `ginginoverbay@gmail.com`
- `emailsean@duck.com`

**Do this in the Supabase dashboard** (Authentication → Users → *Invite user*) so each person sets their own password via the invite email — no password ever gets typed or stored anywhere it shouldn't be.

Then grant admin rights. Once the auth users exist, run this in the Yakima SQL editor — it's idempotent and matches by email:

```sql
insert into public.admin_users (user_id)
select u.id
from auth.users u
where u.email in (
  'heatherismith52@gmail.com',
  'ginginoverbay@gmail.com',
  'emailsean@duck.com'
)
on conflict (user_id) do nothing;

-- verify
select u.email, (a.user_id is not null) as is_admin
from auth.users u
left join public.admin_users a on a.user_id = u.id;
```

> If `admin_users` has columns beyond `user_id` (e.g. `org_id`), add them — check the `20260609000100_admin_users` migration.

---

## Step 3 — Set Supabase Auth URLs

Yakima prod → Authentication → URL Configuration. Without these, reset and invite links break.

- **Site URL:** `https://medvolunteer.vercel.app`
- **Redirect URLs:**
  - `https://medvolunteer.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

---

## Step 4 — Deploy the code fixes

Four files changed in this session (all verified on disk):

| File | Change |
|---|---|
| `web/lib/supabase/client.ts` | Replaced `!` non-null assertions with an explicit check that throws a named, actionable error listing exactly which env var is missing |
| `web/app/login/page.tsx` | `handleLogin` wrapped in `try/catch/finally` — config errors now surface as a visible message instead of an infinite spinner. "Forgot password?" changed from a decorative `<span>` to a real `<Link href="/forgot-password">` |
| `web/app/forgot-password/page.tsx` | **New** — admin reset-request page |
| `web/app/set-password/page.tsx` | **New** — admin set-new-password page, redirects to `/dashboard` |
| `web/app/auth/callback/route.ts` | Errors on admin recovery links now return to `/login` instead of stranding admins at `/volunteer/login` |

> ⚠️ **Build and commit from Windows, not the Cowork sandbox.** The sandbox's Linux mount is a lagging view of the repo and desyncs from the Windows filesystem in two ways: it returns **partial file contents** (e.g. `client.ts` is 31 complete lines on Windows but reads as 212 bytes / 4 lines through bash), and it serves **stale `stat` data** — which makes git skip its content check and report a genuinely modified file as `CLEAN`. A `git add -A` through that mount can stage a partial file or silently skip a changed one.
>
> The files themselves are fine — Claude's Read/Write/Edit tools talk to Windows directly and are accurate. Only the sandbox's `bash` view is unreliable. Run `npm run build` in `web/` and do all git operations on Windows.

---

## Step 5 — Verify

1. `medvolunteer.vercel.app/login` → sign in as an admin → lands on `/dashboard`.
2. Deliberately sign in with a wrong password → you get **"Invalid login credentials"**, not a hanging spinner.
3. Click **Forgot password?** → reset email arrives → link → `/set-password` → new password → `/dashboard`.
4. Supabase → Yakima prod → Logs → Auth: you should now see `/token` requests with referer `medvolunteer.vercel.app`.

---

## Note on the old project

`cquvutwulbtgklqrbamd` ("Volistapp's Project") still holds the real volunteer data and the working admin accounts. **Don't delete it** until Yakima prod is verified end-to-end and any production data you care about has been migrated across. Right now Yakima has 0 volunteers.
