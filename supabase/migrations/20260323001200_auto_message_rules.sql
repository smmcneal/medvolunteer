-- Feature #12: Auto Message Rules
-- Trigger automated emails to volunteers based on shift reminders, cert expiry, or open shifts

CREATE TABLE auto_message_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('shift_reminder', 'cert_expiry', 'open_shift')),
  template_id  UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  days_before  INT NOT NULL DEFAULT 1,
  channel      TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'push')),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auto_message_rules_org ON auto_message_rules(org_id);

ALTER TABLE auto_message_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_auto_message_rules"
  ON auto_message_rules FOR ALL
  USING (true)
  WITH CHECK (true);
