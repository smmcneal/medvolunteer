-- Feature #3: preferred_language — volunteer language preference (en/es)

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en';
