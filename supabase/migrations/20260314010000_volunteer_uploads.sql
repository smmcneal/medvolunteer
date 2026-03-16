-- =============================================================================
-- MIGRATION: Volunteer file uploads + Supabase Storage bucket
-- =============================================================================

-- ─── volunteer_uploads table ──────────────────────────────────────────────────

create table volunteer_uploads (
  id            uuid        primary key default gen_random_uuid(),
  volunteer_id  uuid        references volunteers(id) on delete cascade not null,
  name          text        not null,
  mime_type     text        not null default '',
  size_bytes    bigint      not null default 0,
  storage_path  text        not null,
  uploaded_by   uuid        references auth.users(id) on delete set null,
  uploaded_at   timestamptz default now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table volunteer_uploads enable row level security;

create policy "volunteer_uploads_select"
  on volunteer_uploads for select to authenticated using (true);

create policy "volunteer_uploads_insert"
  on volunteer_uploads for insert to authenticated with check (true);

create policy "volunteer_uploads_delete"
  on volunteer_uploads for delete to authenticated using (true);

-- ─── Storage bucket ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'volunteer-documents',
  'volunteer-documents',
  false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'text/plain'
  ]
) on conflict (id) do nothing;

-- ─── Storage RLS policies ────────────────────────────────────────────────────

create policy "vol_docs_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'volunteer-documents');

create policy "vol_docs_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'volunteer-documents');

create policy "vol_docs_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'volunteer-documents');
