-- Feature #17: Approving Hours
-- Adds approval workflow fields to time_entries

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'auto_approved',
  ADD COLUMN IF NOT EXISTS approved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_time_entries_approval_status ON time_entries (approval_status);
