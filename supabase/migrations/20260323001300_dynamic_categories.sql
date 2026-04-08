-- =============================================================================
-- Dynamic Categories: replace volunteer_category enum array with text[] + table
-- =============================================================================

-- 1. Create the categories table
CREATE TABLE IF NOT EXISTS categories (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT    UNIQUE NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_manage_categories" ON categories FOR ALL USING (true);

-- 2. Seed with existing enum values (slug = enum value, name = display label)
INSERT INTO categories (slug, name, sort_order) VALUES
  ('medical_professional', 'Medical Professional', 0),
  ('support_staff',        'Support Staff',        1),
  ('admin',                'Admin / Coordinator',  2),
  ('trainee',              'Trainee',              3),
  ('other',                'Other',                4)
ON CONFLICT (slug) DO NOTHING;

-- 3. Drop the old GIN index on volunteer_categories (it's typed to volunteer_category[])
DROP INDEX IF EXISTS idx_volunteers_categories;

-- 4. Change volunteer_categories column from volunteer_category[] to text[]
--    The slug values are identical to the enum values, so no data transform needed.
--    Primary cast form:
ALTER TABLE volunteers
  ALTER COLUMN volunteer_categories TYPE text[]
  USING volunteer_categories::text[];

-- 5. Recreate GIN index for the new text[] column
CREATE INDEX idx_volunteers_categories ON volunteers USING GIN (volunteer_categories);

-- 6. Fix org_category_coordinators table (uses volunteer_category type)
--    category_requirements uses category_name (TEXT) so no conversion needed there.
ALTER TABLE org_category_coordinators
  ALTER COLUMN category TYPE text
  USING category::text;
