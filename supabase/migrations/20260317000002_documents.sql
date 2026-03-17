-- ─── volunteer_uploads: add category column ──────────────────────────────────
alter table volunteer_uploads
  add column if not exists category text not null default 'document';

-- ─── org_documents: admin-managed org-level documents ────────────────────────
create table if not exists org_documents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  storage_path text,        -- null for preset (public) files
  public_path  text,        -- e.g. '/org-doc-summary-of-rights.pdf' for preset files
  mime_type    text not null default 'application/pdf',
  size_bytes   bigint not null default 0,
  is_preset    boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz default now()
);

-- RLS: volunteers can read; admin writes via service role
alter table org_documents enable row level security;

create policy "Org docs readable by authenticated"
  on org_documents for select
  to authenticated
  using (true);

-- Seed the 4 preset documents
insert into org_documents (name, public_path, is_preset, sort_order, mime_type) values
  ('Summary of Rights (WFCRA/SOW)', '/org-doc-summary-of-rights.pdf', true, 1, 'application/pdf'),
  ('Background Check Authorization', '/org-doc-bg-check-auth.pdf', true, 2, 'application/pdf'),
  ('Disclosure Regarding Background Investigation', '/org-doc-bg-disclosure.pdf', true, 3, 'application/pdf'),
  ('Federal FCRA Consumer Rights Summary', '/org-doc-fcra-consumer-rights.pdf', true, 4, 'application/pdf');
