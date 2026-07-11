-- =============================================================================
-- Pre-cutover DB hardening (ROADMAP A3.5)
-- =============================================================================
-- Findings from the Supabase security advisors, run against the preview
-- project (cquvutwulbtgklqrbamd):
--   * 2 functions with a mutable search_path (function_search_path_mutable)
--   * 39 tables exposed to anon + authenticated via the default PostgREST/
--     GraphQL grants (pg_graphql_anon_table_exposed / _authenticated_table_exposed)
--
-- Every read and write in this app goes through a server action after
-- requireAdmin()/requireVolunteer(), using the service-role client
-- (createAdminClient()), which bypasses RLS and grants entirely. The browser
-- client (createBrowserClient()) is only ever used for Supabase Auth calls
-- (signInWithPassword, signOut, updateUser, getUser) — confirmed by grep,
-- there is no client-side `.from(...)` table query anywhere in web/. So the
-- anon/authenticated roles have no legitimate reason to hold table grants at
-- all, and revoking them closes the GraphQL/PostgREST exposure without
-- touching app behavior.
--
-- Leaked-password protection (HaveIBeenPwned check) is an Auth service
-- setting, not a database object — it isn't scriptable from a SQL migration.
-- Enable it manually: Dashboard → Authentication → Policies → Password
-- Security → "Leaked password protection". Do this for both the preview
-- project and the fresh prod project created in A3, before real data goes in.

-- ─── 1. Pin search_path on the 2 flagged functions ───────────────────────────
-- Both reference unqualified tables (shifts, shift_assignments) and now(),
-- so search_path is pinned to 'public, pg_temp' rather than emptied — this
-- removes the "mutable" warning while preserving current behavior exactly.

alter function public.update_updated_at()      set search_path = 'public, pg_temp';
alter function public.enforce_shift_capacity() set search_path = 'public, pg_temp';

-- ─── 2. Revoke anon/authenticated table grants ────────────────────────────────
-- RLS is already enabled with no policies on these tables (deny-by-default,
-- see 20260609000200_rls_lockdown.sql), so this is defense-in-depth: it also
-- removes the tables from PostgREST/GraphQL schema discovery for anyone
-- holding just the anon or authenticated (publishable) key.

revoke all on all tables in schema public from anon, authenticated;

-- Also strip the default grants Postgres/Supabase applies to new tables, so
-- future migrations don't silently reopen this.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
