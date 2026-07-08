# Yakima Free Clinic — Production Cutover Runbook
*Replaces the obsolete SiteGround Phase 10 in `MedVolunteer-roadmap.txt`. The app already deploys via Vercel (project `medvolunteer`, team `medvol`); this closes the gap between "client preview" and "production".*

## Current state (verified 2026-07-06)
- Production deploy READY at medvolunteer.vercel.app from commit `c88af36` (Apr 29).
- 25 migrations, **7** edge functions: advance-onboarding, background-check-webhook, clock-in, clock-out, initiate-background-check, send-message, send-push. (Original design in `MedVolunteer-roadmap.txt` listed 8; the 8th — `docusign-webhook` — was never built. E-signature status is tracked via the `documents.provider` column, not an edge function. Count reconciled 2026-07-08, A2.)
- `supabase/seed-demo.sql` exists — the preview Supabase project likely contains demo data.
- No custom domain attached to the Vercel project.

## Step 0 — Decide: reuse or fresh Supabase project
The client preview was seeded with demo data. Either wipe the existing cloud project or (cleaner) create a fresh production project. Fresh is recommended — the preview stays usable for sales demos.

## Step 1 — Production Supabase
```bash
supabase link --project-ref <PROD_PROJECT_REF>
supabase db push                 # all 25 migrations
supabase functions deploy        # all 7 functions
```
Set function secrets (service role key, RESEND_API_KEY, VAPID keys) via `supabase secrets set`.

> **Note (A2):** `send-push` has a function directory but no `[functions.send-push]` block in `config.toml`. `supabase functions deploy` still deploys it (it deploys every directory under `functions/`), and it works because `send-message` calls it with the service-role key (a valid JWT that passes the default `verify_jwt=true`). Optionally add a `[functions.send-push]` block for parity — not a blocker for cutover.

## Step 2 — Auth configuration (Supabase Dashboard → Auth → URL Configuration)
- Site URL: production domain (below)
- Redirect URLs: `https://<domain>/auth/callback` and `http://localhost:3000/auth/callback`
- Required for magic links, password reset, email confirmation.

## Step 3 — Domain
Decide with Yakima: `yakima.envolv.app` (recommended — reinforces the Envolv umbrella) or a clinic-owned domain.
- Vercel → medvolunteer project → Settings → Domains → add domain; add the CNAME at the envolv.app DNS host.
- Then update Step 2 URLs to match.

## Step 4 — Vercel env vars (Production)
Point `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` at the prod project; set `RESEND_API_KEY`, `RESEND_FROM_EMAIL=noreply@envolv.org` (verify envolv.org in Resend first), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `CRON_SECRET`, `VERCEL_WEBHOOK_SECRET`. Redeploy.

## Step 5 — First real data
- Create Yakima org row + first admin account (Supabase Auth user + `volunteers` row, `status = 'active'`).
- Set VAPID keys in Admin → Settings → Web Push.
- Do NOT run `seed-demo.sql` on prod.

## Step 6 — Smoke test (on the production domain)
- [ ] Admin login at `/login`; volunteer login at `/volunteer/login`
- [ ] Volunteer invite magic link end-to-end
- [ ] PWA install prompt (Chrome/Android); offline page with network disabled
- [ ] Push notification permission + test push
- [ ] Geolocation clock-in/out on Shifts tab (geofence)
- [ ] Cron: `GET /api/cron/send-auto-messages` with `Authorization: Bearer <CRON_SECRET>` returns 200
- [ ] Lighthouse PWA score ≥ 90

## Step 7 — Handoff
- Client sign-off with Yakima; deliver admin credentials securely.
- Delete stale remote branches (`fix/DEV-00007..9` are merged): `git push origin --delete <branch>`.
- Mark Phase 9/10 complete in the roadmap.

## Blocked on Sean (credentials/decisions)
1. Reuse preview Supabase or create fresh prod project (Step 0)
2. Supabase access token / dashboard access
3. Domain choice + DNS host login for envolv.app
4. Resend domain verification for envolv.org
5. Yakima contact for sign-off
