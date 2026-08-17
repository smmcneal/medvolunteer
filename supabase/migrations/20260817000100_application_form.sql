-- =============================================================================
-- AB-0023: Application Form builder
-- =============================================================================
-- Admin-configurable public application form. The field list is versioned:
-- every save in the Settings builder inserts a new row into
-- application_form_versions rather than mutating one in place, so the most
-- recent row per org is simply "the live form" and the full history is a
-- plain ordered scan. Restoring an old version re-inserts its snapshot as a
-- brand-new version (via restored_from), so a restore shows up in the
-- history too instead of rewriting it.

CREATE TABLE application_form_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fields        JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  restored_from UUID REFERENCES application_form_versions(id) ON DELETE SET NULL
);

CREATE INDEX idx_application_form_versions_org ON application_form_versions (org_id, created_at DESC);

ALTER TABLE application_form_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_application_form_versions"
  ON application_form_versions FOR ALL
  USING (true) WITH CHECK (true);

-- Standard applicant fields (name, email, phone, categories, notes,
-- communication preference) land directly on the volunteers row, same as
-- the existing /apply flow. This table only captures answers to the org's
-- custom fields. Each answer stores its own label/type at submission time
-- (self-describing) so history stays readable after a field is renamed or
-- removed from the live form.
CREATE TABLE application_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  volunteer_id    UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  form_version_id UUID REFERENCES application_form_versions(id) ON DELETE SET NULL,
  responses       JSONB NOT NULL DEFAULT '{}',
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_submissions_volunteer ON application_submissions (volunteer_id);
-- Backs the rate-limit check in submitApplication (count recent rows per IP).
CREATE INDEX idx_application_submissions_rate_limit ON application_submissions (org_id, ip_address, created_at);

ALTER TABLE application_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_application_submissions"
  ON application_submissions FOR ALL
  USING (true) WITH CHECK (true);

-- Communication preference — one of the fields the applicant always sees.
ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS communication_preference TEXT NOT NULL DEFAULT 'email'
  CHECK (communication_preference IN ('email', 'phone', 'both'));
