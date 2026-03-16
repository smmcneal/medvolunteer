-- =============================================================================
-- MIGRATION: Pipeline phases, Tags, Flags, Notes, Mentor pairing
-- =============================================================================

-- ─── 1. Replace volunteer_status enum ────────────────────────────────────────
-- Old values: applicant, onboarding, active, inactive, suspended
-- New values: applicant, prospect, volunteer, inactive

create type volunteer_status_new as enum (
  'applicant', 'prospect', 'volunteer', 'inactive'
);

-- Drop the default so we can change the column type
alter table volunteers alter column status drop default;

alter table volunteers
  alter column status type volunteer_status_new
  using (
    case status::text
      when 'applicant'  then 'applicant'::volunteer_status_new
      when 'onboarding' then 'prospect'::volunteer_status_new
      when 'active'     then 'volunteer'::volunteer_status_new
      when 'inactive'   then 'inactive'::volunteer_status_new
      when 'suspended'  then 'inactive'::volunteer_status_new
      else 'applicant'::volunteer_status_new
    end
  );

drop type volunteer_status;
alter type volunteer_status_new rename to volunteer_status;

-- Restore the default with the renamed type
alter table volunteers alter column status set default 'applicant'::volunteer_status;

-- ─── 2. Pipeline phase enum + column ─────────────────────────────────────────

create type pipeline_phase as enum (
  'intake', 'orientation', 'review', 'training', 'active', 'offboarding'
);

alter table volunteers
  add column pipeline_phase pipeline_phase not null default 'intake';

-- ─── 3. Tags ─────────────────────────────────────────────────────────────────

create table org_tags (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organizations(id) on delete cascade not null,
  name       text not null,
  color      text not null default '#6b7280',
  created_at timestamptz default now(),
  unique(org_id, name)
);

create table volunteer_tags (
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  tag_id       uuid references org_tags(id) on delete cascade not null,
  applied_at   timestamptz default now(),
  primary key (volunteer_id, tag_id)
);

create index on org_tags(org_id);
create index on volunteer_tags(volunteer_id);

-- ─── 4. Flags ─────────────────────────────────────────────────────────────────

create type flag_severity as enum ('info', 'warning', 'critical');

create table org_flags (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete cascade not null,
  name        text not null,
  description text,
  severity    flag_severity not null default 'info',
  color       text not null default '#6b7280',
  created_at  timestamptz default now(),
  unique(org_id, name)
);

create table volunteer_flags (
  id          uuid primary key default gen_random_uuid(),
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  flag_id      uuid references org_flags(id) on delete cascade not null,
  notes        text,
  raised_at    timestamptz default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users(id) on delete set null
);

create index on org_flags(org_id);
create index on volunteer_flags(volunteer_id);

-- ─── 5. Notes (replace volunteers.notes text field) ──────────────────────────

create table volunteer_notes (
  id           uuid primary key default gen_random_uuid(),
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  content      text not null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now()
);

create index on volunteer_notes(volunteer_id);
create index on volunteer_notes(created_at);

-- Migrate existing notes text into the new table
insert into volunteer_notes (volunteer_id, content, created_at)
select id, notes, created_at
from volunteers
where notes is not null and trim(notes) <> '';

-- Drop the old single-field notes column
alter table volunteers drop column notes;

-- ─── 6. Mentor pairing on shift_assignments ──────────────────────────────────

alter table shift_assignments
  add column mentor_id uuid references volunteers(id) on delete set null;

create index on shift_assignments(mentor_id);

-- ─── 7. RLS ───────────────────────────────────────────────────────────────────

alter table org_tags        enable row level security;
alter table volunteer_tags  enable row level security;
alter table org_flags       enable row level security;
alter table volunteer_flags enable row level security;
alter table volunteer_notes enable row level security;

-- Authenticated users can read (admin writes go through service-role client)
create policy "auth read org_tags"
  on org_tags for select to authenticated using (true);

create policy "auth read volunteer_tags"
  on volunteer_tags for select to authenticated using (true);

create policy "auth read org_flags"
  on org_flags for select to authenticated using (true);

create policy "auth read volunteer_flags"
  on volunteer_flags for select to authenticated using (true);

create policy "auth read volunteer_notes"
  on volunteer_notes for select to authenticated using (true);
