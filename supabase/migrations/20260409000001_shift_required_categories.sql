-- Add required_categories to shifts table
-- Empty array means open to all volunteers; non-empty restricts to matching category slugs.
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS required_categories text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_shifts_required_categories
  ON shifts USING GIN (required_categories);
