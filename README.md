# MedVolunteer

Volunteer management platform for medical clinics — an admin dashboard and an installable volunteer PWA on a shared Supabase backend.

| Zone | URL | Who |
|------|-----|-----|
| Admin dashboard | `/dashboard` | Clinic coordinators (must be in `admin_users`) |
| Volunteer PWA | `/volunteer` | Volunteers (mobile-first, installable, offline-capable) |
| Public | `/`, `/apply` | Marketing page + volunteer application form |

## Stack

- **Web**: Next.js 14 (App Router), TypeScript, Tailwind CSS v4 — lives in `web/`
- **Backend**: Supabase (Postgres + RLS, Auth, Storage, Edge Functions) — lives in `supabase/`
- **Email**: Resend · **Hosting**: Vercel (cron in `web/vercel.json`)

## Quick start

```bash
# 1. Backend (requires Docker)
npx supabase start
npx supabase db reset        # migrations + seed data

# 2. Web app
cd web
cp .env.example .env.local   # fill in values from `npx supabase status`
npm install
npm run dev                  # http://localhost:3000
```

Seeded dev logins (local only): `admin@medvolunteer.org` / `admin123` and `alice@example.com` / `volunteer123`.
Or use the dev auto-login endpoint: `GET /api/dev/login?role=admin&redirect=/dashboard`.

## Security model

- **Admin role** is explicit: membership in the `admin_users` table, enforced by `requireAdmin()` (`web/lib/auth.ts`) inside the dashboard layout *and* every admin server action.
- **RLS is deny-by-default on every table.** All database access goes through server actions using the service-role client after an auth check — browsers never query Postgres directly.
- Volunteer documents live in a private storage bucket; access is via short-lived signed URLs issued server-side after ownership checks.

See [CLAUDE.md](CLAUDE.md) for architecture details and conventions.
