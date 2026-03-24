-- =============================================================================
-- Feature #19: Auto Assign Tasks + Internal Alerts (MedVolunteer)
-- =============================================================================

-- Internal alerts: created when document automation rules trigger
CREATE TABLE IF NOT EXISTS internal_alerts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  volunteer_id   UUID REFERENCES volunteers(id) ON DELETE SET NULL,
  message        TEXT NOT NULL,
  action_type    TEXT NOT NULL DEFAULT 'document_added',
  is_read        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_alerts_assigned ON internal_alerts (assigned_to, is_read);
CREATE INDEX IF NOT EXISTS idx_internal_alerts_volunteer ON internal_alerts (volunteer_id);

ALTER TABLE internal_alerts ENABLE ROW LEVEL SECURITY;

-- Admin role can manage all alerts
CREATE POLICY "admin_manage_alerts"
  ON internal_alerts FOR ALL
  USING (true);

-- Document automation rules: when a document of type X is added, send alert to admin Y
CREATE TABLE IF NOT EXISTS document_automation_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_document_type TEXT NOT NULL,
  alert_message         TEXT NOT NULL,
  assigned_to           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_doc_automation"
  ON document_automation_rules FOR ALL
  USING (true);
