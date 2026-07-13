-- =============================================================================
-- Admin roles — Users & Permissions
-- =============================================================================
-- admin_users was previously a flat membership table (any row = full admin
-- access). This adds a `role` so an org can distinguish owners (who can
-- invite/remove other admin users) from regular admins (dashboard access
-- only, no user management).

alter table admin_users
  add column if not exists role text not null default 'admin' check (role in ('owner', 'admin')),
  add column if not exists invited_by uuid references auth.users(id) on delete set null;

-- Grandfather every existing admin in as an owner so nobody loses the
-- ability to manage users when this migration lands.
update admin_users set role = 'owner';
