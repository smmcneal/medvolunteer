-- =============================================================================
-- Admin role model
-- =============================================================================
-- Until now "admin" was implicit: any authenticated user without a volunteers
-- row. This table makes the role explicit. Dashboard access and every admin
-- server action check membership here via requireAdmin() (web/lib/auth.ts).

create table if not exists admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Service-role access only: RLS enabled with no policies.
alter table admin_users enable row level security;

-- Bootstrap: existing auth users that have no volunteer record were the de
-- facto admins under the old implicit model. Grandfather them in so nobody
-- is locked out of the dashboard when this migration lands in production.
insert into admin_users (user_id)
select u.id
from auth.users u
where not exists (
  select 1 from volunteers v where v.user_id = u.id
)
on conflict (user_id) do nothing;
