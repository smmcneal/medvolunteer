-- Add admin-managed onboarding checklist fields to volunteers
alter table volunteers
  add column if not exists checklist_bg_form_signed          boolean not null default false,
  add column if not exists checklist_video_watched           boolean not null default false,
  add column if not exists checklist_id_verified             boolean not null default false,
  add column if not exists checklist_certifications_submitted boolean not null default false;
