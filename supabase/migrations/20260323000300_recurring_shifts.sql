-- Feature #7: Recurring Shifts
-- Adds recurrence fields to shifts table

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS recurrence_rule       TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_group_id   UUID,
  ADD COLUMN IF NOT EXISTS recurrence_end_date   DATE;

-- Index for efficient bulk operations on a recurrence group
CREATE INDEX IF NOT EXISTS idx_shifts_recurrence_group
  ON shifts (recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;
