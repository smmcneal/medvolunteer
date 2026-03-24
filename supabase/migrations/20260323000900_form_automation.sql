-- Feature #11: Form Automation Rules
-- Allows admins to auto-assign categories, flags, or tags when application fields match values

CREATE TABLE form_automation_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  field_key    TEXT NOT NULL,
  field_value  TEXT NOT NULL,
  action_type  TEXT NOT NULL CHECK (action_type IN ('assign_category', 'assign_flag', 'assign_tag')),
  action_value TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_automation_rules_org ON form_automation_rules(org_id);

ALTER TABLE form_automation_rules ENABLE ROW LEVEL SECURITY;

-- RLS: admins access via service role (createAdminClient)
CREATE POLICY "admin_form_automation_rules"
  ON form_automation_rules FOR ALL
  USING (true)
  WITH CHECK (true);
