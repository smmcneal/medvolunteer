-- Add handbook acknowledgment fields to volunteers
alter table volunteers
  add column if not exists handbook_signed_at  timestamptz,
  add column if not exists handbook_signed_name text;
