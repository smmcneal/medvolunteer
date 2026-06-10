-- =============================================================================
-- RLS lockdown
-- =============================================================================
-- Every read and write in the app goes through the server (service-role
-- client) after an auth check — there is no direct PostgREST access from the
-- browser. So the database posture is deny-by-default: RLS enabled on every
-- table, no anon/authenticated policies. The service role bypasses RLS.
--
-- Also in this migration (schema integrity fixes found in the 2026-06 audit):
--   * messages.sender_id now references auth.users (admins are not volunteers)
--   * one open time entry per volunteer, enforced by partial unique index
--   * shift capacity enforced by trigger (closes the check-then-insert race)
--   * missing indexes for common access paths

-- ─── 1. Enable RLS on every core table (deny-by-default) ─────────────────────

alter table organizations        enable row level security;
alter table locations            enable row level security;
alter table volunteers           enable row level security;
alter table volunteer_locations  enable row level security;
alter table credentials          enable row level security;
alter table documents            enable row level security;
alter table background_checks    enable row level security;
alter table onboarding_workflows enable row level security;
alter table onboarding_stages    enable row level security;
alter table onboarding_progress  enable row level security;
alter table shifts               enable row level security;
alter table shift_assignments    enable row level security;
alter table time_entries         enable row level security;
alter table learning_modules     enable row level security;
alter table lessons              enable row level security;
alter table quiz_questions       enable row level security;
alter table lesson_completions   enable row level security;
alter table forms                enable row level security;
alter table form_submissions     enable row level security;
alter table messages             enable row level security;
alter table message_recipients   enable row level security;

-- ─── 2. Drop overbroad policies on tables that already had RLS ───────────────
-- These allowed any authenticated user (and in one case anon) to read or
-- write admin-only data. All of this access now goes through server actions.

drop policy if exists "Volunteers manage own push subscriptions" on push_subscriptions;

drop policy if exists "auth read org_tags"        on org_tags;
drop policy if exists "auth read volunteer_tags"  on volunteer_tags;
drop policy if exists "auth read org_flags"       on org_flags;
drop policy if exists "auth read volunteer_flags" on volunteer_flags;
drop policy if exists "auth read volunteer_notes" on volunteer_notes;

drop policy if exists "volunteer_uploads_select" on volunteer_uploads;
drop policy if exists "volunteer_uploads_insert" on volunteer_uploads;
drop policy if exists "volunteer_uploads_delete" on volunteer_uploads;

drop policy if exists "Org docs readable by authenticated" on org_documents;

drop policy if exists "authenticated_select_holidays" on org_holidays;
drop policy if exists "authenticated_insert_holidays" on org_holidays;
drop policy if exists "authenticated_delete_holidays" on org_holidays;

drop policy if exists "admin_all_category_requirements"  on category_requirements;
drop policy if exists "admin_all_category_coordinators"  on org_category_coordinators;
drop policy if exists "admin_manage_alerts"              on internal_alerts;
drop policy if exists "admin_manage_doc_automation"      on document_automation_rules;
drop policy if exists "org_admin_templates"              on message_templates;
drop policy if exists "admin_form_automation_rules"      on form_automation_rules;
drop policy if exists "admin_auto_message_rules"         on auto_message_rules;
drop policy if exists "admin_manage_categories"          on categories;

-- ─── 3. Storage: volunteer-documents is service-role only ────────────────────
-- Uploads and downloads happen via server actions (admin client + signed
-- URLs) with per-volunteer ownership checks. The old policies let any
-- authenticated user read and delete every volunteer's files.

drop policy if exists "vol_docs_select" on storage.objects;
drop policy if exists "vol_docs_insert" on storage.objects;
drop policy if exists "vol_docs_delete" on storage.objects;

-- ─── 4. messages.sender_id → auth.users ──────────────────────────────────────
-- Admins send messages but have no volunteers row, so the old FK to
-- volunteers(id) made every admin send fail. Null out any orphaned values
-- before re-pointing the constraint.

alter table messages drop constraint if exists messages_sender_id_fkey;

update messages set sender_id = null
where sender_id is not null
  and sender_id not in (select id from auth.users);

alter table messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references auth.users(id) on delete set null;

-- ─── 5. One open time entry per volunteer ────────────────────────────────────
-- Close any duplicate open entries first (keep the most recent), then
-- enforce with a partial unique index.

with ranked as (
  select id, row_number() over (partition by volunteer_id order by clock_in desc) as rn
  from time_entries
  where clock_out is null
)
update time_entries
set clock_out = clock_in
where id in (select id from ranked where rn > 1);

create unique index if not exists uniq_open_time_entry_per_volunteer
  on time_entries (volunteer_id)
  where clock_out is null;

-- ─── 6. Shift capacity trigger ────────────────────────────────────────────────
-- Serializes concurrent sign-ups by locking the shift row, so two volunteers
-- can no longer both pass an application-side count check and oversubscribe.

create or replace function enforce_shift_capacity()
returns trigger as $$
declare
  cap int;
  taken int;
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  select required_count into cap
  from shifts
  where id = new.shift_id
  for update;

  if cap is null then
    return new;
  end if;

  select count(*) into taken
  from shift_assignments
  where shift_id = new.shift_id
    and status <> 'cancelled'
    and id <> new.id;

  if taken >= cap then
    raise exception 'Shift is full (capacity %)', cap;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists shift_capacity_check on shift_assignments;
create trigger shift_capacity_check
  before insert or update on shift_assignments
  for each row execute function enforce_shift_capacity();

-- ─── 7. Missing indexes ───────────────────────────────────────────────────────

create index if not exists idx_shift_assignments_shift_id
  on shift_assignments (shift_id);
create index if not exists idx_message_recipients_message_id
  on message_recipients (message_id);
create index if not exists idx_message_recipients_volunteer_id
  on message_recipients (volunteer_id);
