# Yakima Free Clinic — Production Cutover Runbook
*Replaces the obsolete SiteGround Phase 10 in `MedVolunteer-roadmap.txt`. The app deploys via Vercel (project `medvolunteer`, team `medvol`); this closes the gap between "client preview" and "production".*

---

## ✅ Progress — updated 2026-07-11

A **fresh production Supabase project** is now created and schema-loaded. The old
project stays untouched as the sales-demo environment.

| | Preview / demo (unchanged) | **Production (new)** |
|---|---|---|
| Name | Volistapp's Project | **Envolv Yakima (prod)** |
| Ref | `cquvutwulbtgklqrbamd` | **`vopgctgjxbpytntthoxb`** |
| Region | us-west-2 | us-west-1 |
| Org | Volist (`yqowwdbfzmwyavdyqows`) | Volist (`yqowwdbfzmwyavdyqows`) |
| Data | demo data (14 volunteers etc.) | clean — org `Yakima Free Clinic`, 0 volunteers |
| Cost | free tier | free tier ($0/mo — 2nd project on the plan) |

Dashboard: https://supabase.com/dashboard/project/vopgctgjxbpytntthoxb

**What was done automatically (verified):**
- All 27 repo migrations applied. Schema fingerprint is **byte-identical** to the preview project (39 tables, 300 columns, matching column + enum hashes).
- Migration history (`supabase_migrations.schema_migrations`) reconciled to the exact 27 repo versions, so a future `supabase db push` from CI is a clean no-op.
- Demo hygiene: org row renamed `City Free Clinic` → **`Yakima Free Clinic`**; the two placeholder Springfield locations and two demo shifts were deleted. `seed-demo.sql` was **not** run.
- Kept as starter templates (review/customize, not demo PII): 5 categories, 1 onboarding workflow (5 stages), 2 learning modules (3 lessons, 2 quiz questions), 4 preset FCRA/background-check org documents, and the `volunteer-documents` storage bucket.
- Security advisors reviewed: the 42 "RLS enabled, no policy" notices are **by design** (deny-by-default; all access via the service-role client after an auth guard — see `20260609000200_rls_lockdown.sql`). Two `function_search_path_mutable` warnings are inherited from the repo's own functions and also present on the preview project — not introduced here.

> **Domain decision (Sean, 2026-07-11):** do **not** touch `envolv.app` DNS yet — that becomes the umbrella site later, with Yakima as one client under it. So `yakima.envolv.app` and the Vercel production env/domain flip are **deferred** (Step 3 / Step 4-B below). The prod DB is provisioned and waiting; the public cutover happens once the domain is wired and Yakima signs off.

---

## Steps 0–1 — Production Supabase ✅ (mostly done)

- [x] **Step 0 — Fresh prod project** (chosen over reusing the demo project) — created.
- [x] **Step 1a — Apply schema / migrations** to `vopgctgjxbpytntthoxb` — done via the Supabase connector; history reconciled.
- [ ] **Step 1b — Reset the DB password.** The project was created with an auto-generated password nobody has. Dashboard → Settings → Database → **Reset database password**; store it in your password manager. Needed only for direct `psql` / CLI / CI migrations (the app itself does not use it).
  - Database settings: https://supabase.com/dashboard/project/vopgctgjxbpytntthoxb/settings/database
- [x] **Step 1c — Deploy the 7 edge functions to prod** — done 2026-07-11 via the Supabase connector. All ACTIVE at version 1, `verify_jwt` matching `config.toml`: `clock-in`, `clock-out`, `advance-onboarding`, `initiate-background-check`, `send-message`, `send-push` (jwt on); `background-check-webhook` (jwt **off**, Checkr HMAC). Redeploys from CLI later are fine: `supabase link --project-ref vopgctgjxbpytntthoxb && supabase functions deploy`.
- [ ] **Step 1c-secrets — Set the function runtime secrets.** The Supabase-provided vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are **auto-injected** — do not set them. Only the third-party ones are needed, and each function degrades gracefully until then (email/SMS/push log a `[STUB]` and no-op; the Checkr webhook returns 500 until its secret exists). Set via Dashboard → Edge Functions → Secrets, or `supabase secrets set`:
  - `RESEND_API_KEY` — real email in `send-message` (else stub).
  - `VAPID_PUBLIC_KEY` — gates push in `send-message`; the actual VAPID keypair for `send-push` is read from org settings (Step 5 → Admin → Web Push).
  - `CHECKR_API_KEY` (real background checks; else a stub row) and `CHECKR_WEBHOOK_SECRET` (required for `background-check-webhook` to accept callbacks).
  - Optional SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
  > `clock-in`, `clock-out`, and `advance-onboarding` need **no** extra secrets — they run on the auto-injected keys and work now.
  > **Note (A2):** `send-push` has no `[functions.send-push]` block in `config.toml`; it still deploys and works because `send-message` calls it with the service-role key (a valid JWT). Optionally add a block for parity — not a blocker.
- [ ] **Step 1d — Repoint the CI migrator to prod** (do this at cutover, not before, or CI will start migrating prod instead of preview). In GitHub → Settings → Secrets → Actions, set `SUPABASE_PROJECT_ID=vopgctgjxbpytntthoxb` and `SUPABASE_DB_PASSWORD=<the reset value>` (`.github/supabase-migrate.yml`). Because history is reconciled, the first run has nothing to apply.

---

## Step 2 — Auth configuration (Supabase Dashboard → Auth → URL Configuration)
URL config: https://supabase.com/dashboard/project/vopgctgjxbpytntthoxb/auth/url-configuration
- **Site URL:** the production URL. Until the domain is decided, use `https://medvolunteer.vercel.app`; switch to `https://yakima.envolv.app` at cutover.
- **Redirect URLs:** `https://<prod-domain>/auth/callback` **and** `http://localhost:3000/auth/callback`.
- Required for magic links, password reset, and email confirmation. If these don't match the app's real origin, invite links break.

---

## Step 3 — Domain ⏸️ DEFERRED (per 2026-07-11 decision)
Target is `yakima.envolv.app`, but this is **on hold** — we are intentionally not resolving `envolv.app` DNS yet (it's the future umbrella site). When ready:
- Vercel → `medvolunteer` → Settings → Domains → add `yakima.envolv.app`; add the CNAME at the `envolv.app` DNS host.
- Then update Step 2 URLs to match.
- **Still needed before this can happen:** `envolv.app` DNS host login (the CNAME record).

---

## Step 4 — Vercel env vars
API keys/URL for prod (public-safe values shown; **service_role is secret — copy it from the dashboard**, do not commit it):
- `NEXT_PUBLIC_SUPABASE_URL` = `https://vopgctgjxbpytntthoxb.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcGdjdGdqeGJweXRudHRob3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MjQxMjUsImV4cCI6MjA5OTMwMDEyNX0.9w7uneJ5j6QQk4bPoea_JrO6NkhKC5HRSOgNyGPzNz4`
  - (Modern alternative: publishable key `sb_publishable_1oxclOYsMz5r_8Mpd3l6WQ_nbLRC5Dt`.)
- `SUPABASE_SERVICE_ROLE_KEY` = copy from Settings → API → `service_role` (secret): https://supabase.com/dashboard/project/vopgctgjxbpytntthoxb/settings/api
- Also set/confirm: `RESEND_API_KEY`, `RESEND_FROM_EMAIL=noreply@envolv.org` (verify `envolv.org` in Resend first), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `CRON_SECRET`, `VERCEL_WEBHOOK_SECRET`.

**Step 4-A — keep the demo alive (do now, safe):** set the three Supabase vars above **only in Vercel's "Preview" + "Development" scopes → NO**, leave those on the old project. Concretely: leave **Production** scope pointed at the demo project for now so nothing changes for viewers.

**Step 4-B — the actual flip (at cutover, after Step 3 + sign-off):** set the three Supabase vars in the **Production** scope to the prod project and redeploy. Leave the **Preview** scope on `cquvutwulbtgklqrbamd` so preview deployments keep the demo data for sales demos. This is how "preview stays for demos" is preserved.

---

## Step 5 — First real data (prod)
- [x] Org row exists: **`Yakima Free Clinic`**.
- [ ] **First admin account.** Create a Supabase Auth user (Dashboard → Authentication → Add user) for the clinic admin, then add a row to `admin_users` with that user's `id`. (Admin = membership in `admin_users`; admins have no `volunteers` row.) SQL after creating the auth user:
  ```sql
  insert into admin_users (user_id) values ('<auth-user-uuid>');
  ```
- [ ] Review/customize the starter onboarding workflow, learning modules, and categories, or clear them if Yakima wants a blank slate.
- [ ] Add Yakima's real location(s) (name, address, lat/lng, geofence radius) under Admin → Settings, or directly in `locations`.
- [ ] Set VAPID keys in Admin → Settings → Web Push.
- Do **NOT** run `seed-demo.sql` on prod.

---

## Step 6 — Smoke test (on the production URL, after Step 4-B)
- [ ] Admin login at `/login`; volunteer login at `/volunteer/login`
- [ ] Volunteer invite magic link end-to-end
- [ ] PWA install prompt (Chrome/Android); offline page with network disabled
- [ ] Push notification permission + test push
- [ ] Geolocation clock-in/out on Shifts tab (geofence)
- [ ] Cron: `GET /api/cron/send-auto-messages` with `Authorization: Bearer <CRON_SECRET>` returns 200
- [ ] Lighthouse PWA score ≥ 90

---

## Step 7 — Handoff & sign-off
- [ ] Client sign-off with Yakima — see **`docs/yakima-signoff.md`** for the who/what/how and the outreach draft.
- [ ] Deliver admin credentials securely.
- [ ] Delete stale remote branches (`fix/DEV-00007..9` are merged): `git push origin --delete <branch>`.
- [ ] Mark Phase 9/10 complete in the roadmap.

---

## Blocked on Sean (remaining)
1. ~~Reuse vs. fresh Supabase project~~ — ✅ decided (fresh) and created.
2. Reset the prod DB password (Step 1b) — needed for CI/CLI.
3. `envolv.app` DNS host login for the `yakima.envolv.app` CNAME — **deferred by choice**; unblock when ready for the public domain.
4. Resend domain verification for `envolv.org` (so `noreply@envolv.org` can send).
5. Yakima sign-off contact — see `docs/yakima-signoff.md`.
