-- Add volunteer_categories array to volunteers (keeps existing category column for backward compat)
ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS volunteer_categories volunteer_category[] NOT NULL DEFAULT '{}';

-- GIN index for efficient array membership queries
CREATE INDEX IF NOT EXISTS idx_volunteers_categories ON volunteers USING GIN (volunteer_categories);
