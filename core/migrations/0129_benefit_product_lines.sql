-- Benefit product lines: new layer between families and services
-- Structure: family → product_line → service

CREATE TABLE IF NOT EXISTS benefit_product_lines (
  id text PRIMARY KEY,
  family_key text NOT NULL REFERENCES benefit_families(key) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS benefit_product_lines_family_key_idx ON benefit_product_lines(family_key);

-- Add product_line_id column to services (nullable during migration, existing services will be backfilled by seed code)
ALTER TABLE benefit_services ADD COLUMN IF NOT EXISTS product_line_id text REFERENCES benefit_product_lines(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS benefit_services_product_line_id_idx ON benefit_services(product_line_id) WHERE product_line_id IS NOT NULL;
