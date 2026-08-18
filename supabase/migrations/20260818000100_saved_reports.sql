-- =============================================================================
-- Saved report views
-- =============================================================================
-- Lets an admin capture the filters currently applied on a Reports tab
-- (status/category/date range/pipeline phase) plus which tab they were on,
-- under a name, and reapply that combination later from a dropdown.

create table if not exists saved_reports (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  report_type text not null check (report_type in ('hours', 'onboarding', 'bgchecks', 'credentials', 'inactive')),
  filters     jsonb not null default '{}',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_saved_reports_org_id on saved_reports(org_id);

-- Service-role access only: RLS enabled with no policies, matching the
-- deny-by-default posture set in 20260609000200_rls_lockdown.sql.
alter table saved_reports enable row level security;
