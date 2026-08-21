-- Per-category color, shown on the shift calendar and set from Settings > Categories.
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#6B7280';
