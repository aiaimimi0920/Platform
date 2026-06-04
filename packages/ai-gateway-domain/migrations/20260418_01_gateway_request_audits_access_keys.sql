DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gateway_request_audits_identity_ck'
  ) THEN
    ALTER TABLE gateway_request_audits
      DROP CONSTRAINT gateway_request_audits_identity_ck;
  END IF;

  ALTER TABLE gateway_request_audits
    ADD CONSTRAINT gateway_request_audits_identity_ck
    CHECK (
      api_key_id IS NOT NULL
      OR user_credential_id IS NOT NULL
      OR access_key_id IS NOT NULL
    );
END $$;
