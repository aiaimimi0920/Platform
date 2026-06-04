-- Grant expiry: support duration-based grants (1-day, 7-day, 30-day cards)
ALTER TABLE benefit_user_grants ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE benefit_user_grants ADD COLUMN IF NOT EXISTS duration_days integer;

CREATE INDEX IF NOT EXISTS benefit_user_grants_expires_at_idx ON benefit_user_grants(expires_at) WHERE expires_at IS NOT NULL;
