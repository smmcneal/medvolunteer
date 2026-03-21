-- ─── org_documents: add volunteer_visible flag ───────────────────────────────
-- volunteer_visible = true  → document appears in every volunteer's portal (existing behaviour)
-- volunteer_visible = false → document is admin-only; never surfaced to volunteers

alter table org_documents
  add column if not exists volunteer_visible boolean not null default true;

-- Preset docs are always volunteer-visible (no change needed, default handles it)
-- Existing uploaded docs keep volunteer_visible = true (default)
