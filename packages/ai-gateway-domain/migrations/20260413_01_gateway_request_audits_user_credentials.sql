ALTER TABLE gateway_request_audits
  ALTER COLUMN api_key_id DROP NOT NULL;

ALTER TABLE gateway_request_audits
  ADD COLUMN IF NOT EXISTS user_credential_id TEXT REFERENCES gateway_user_credentials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gateway_request_audits_user_credential_created_idx
  ON gateway_request_audits (user_credential_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gateway_request_audits_identity_ck'
  ) THEN
    ALTER TABLE gateway_request_audits
      ADD CONSTRAINT gateway_request_audits_identity_ck
      CHECK (api_key_id IS NOT NULL OR user_credential_id IS NOT NULL);
  END IF;
END $$;
