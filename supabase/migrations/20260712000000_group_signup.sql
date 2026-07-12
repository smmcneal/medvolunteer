-- =============================================================================
-- Group volunteering: a single sign-up can represent more than one person
-- =============================================================================
-- Lets a volunteer sign up for a shift on behalf of a group (e.g. bringing
-- family or friends). group_size is the total headcount the assignment
-- covers, including the volunteer themself, and counts against the shift's
-- required_count alongside every other non-cancelled assignment.

alter table shift_assignments
  add column if not exists group_size int not null default 1;

alter table shift_assignments
  add constraint shift_assignments_group_size_check check (group_size >= 1);

-- Capacity trigger now sums group_size instead of counting rows.
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

  select coalesce(sum(group_size), 0) into taken
  from shift_assignments
  where shift_id = new.shift_id
    and status <> 'cancelled'
    and id <> new.id;

  if taken + new.group_size > cap then
    raise exception 'Shift is full (capacity %)', cap;
  end if;

  return new;
end;
$$ language plpgsql;
