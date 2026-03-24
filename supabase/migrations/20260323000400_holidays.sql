-- Feature #2: org_holidays — block clinic closures on the shift calendar

CREATE TABLE org_holidays (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  date         DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_holidays_org_id ON org_holidays(org_id);
CREATE INDEX idx_org_holidays_date   ON org_holidays(org_id, date);

ALTER TABLE org_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_holidays"
  ON org_holidays FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_insert_holidays"
  ON org_holidays FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_delete_holidays"
  ON org_holidays FOR DELETE
  TO authenticated
  USING (true);
