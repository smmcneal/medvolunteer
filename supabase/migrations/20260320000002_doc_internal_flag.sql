-- ─── org_documents: separate "repository" from "visibility" ──────────────────
-- is_internal = true  → document lives in the Internal Repository (admin-only, never for volunteers)
-- is_internal = false → document lives in the Volunteer Repository (visibility controlled by volunteer_visible)
--
-- This allows a volunteer-repo doc to be toggled hidden (volunteer_visible=false)
-- without being reclassified as an internal document.

alter table org_documents
  add column if not exists is_internal boolean not null default false;

-- Back-fill: existing docs with volunteer_visible=false were uploaded as internal
update org_documents
  set is_internal = true
  where is_preset = false and volunteer_visible = false;
