-- Redemption Code V2: exclusion groups, eligibility, scheduled activation,
-- multi-reward combos, custom mail, batch labels, operator notes

ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS exclusion_group text;
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS eligibility jsonb;
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS rewards jsonb;
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS mail_title text;
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS mail_body text;
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS batch_label text;
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE INDEX IF NOT EXISTS redemption_codes_exclusion_group_idx ON redemption_codes (exclusion_group) WHERE exclusion_group IS NOT NULL;
CREATE INDEX IF NOT EXISTS redemption_codes_batch_label_idx ON redemption_codes (batch_label) WHERE batch_label IS NOT NULL;
