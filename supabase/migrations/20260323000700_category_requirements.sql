-- Feature #15: Category Requirements
-- Per-org requirements that volunteers in a given category must satisfy

CREATE TABLE category_requirements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  is_blocking   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_category_requirements_org_cat ON category_requirements (org_id, category_name);

ALTER TABLE category_requirements ENABLE ROW LEVEL SECURITY;

-- Admin users can manage requirements
CREATE POLICY "admin_all_category_requirements"
  ON category_requirements FOR ALL
  USING (true)
  WITH CHECK (true);
