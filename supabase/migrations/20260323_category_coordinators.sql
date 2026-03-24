-- Feature #18: Volunteer Coordinators
-- Assigns a volunteer as coordinator for each role/category

CREATE TABLE org_category_coordinators (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category                 TEXT NOT NULL UNIQUE,
  coordinator_volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE org_category_coordinators ENABLE ROW LEVEL SECURITY;

-- Admin session client has full access
CREATE POLICY "admin_all_category_coordinators"
  ON org_category_coordinators FOR ALL
  USING (true) WITH CHECK (true);
