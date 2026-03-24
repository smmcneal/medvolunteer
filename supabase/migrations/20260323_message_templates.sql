-- Message templates for saving and reusing compose content

CREATE TABLE message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  channel     message_channel NOT NULL DEFAULT 'email',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX message_templates_org_id_idx ON message_templates(org_id);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage templates for their org
CREATE POLICY "org_admin_templates"
  ON message_templates FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM volunteers WHERE user_id = auth.uid()
    )
  );
