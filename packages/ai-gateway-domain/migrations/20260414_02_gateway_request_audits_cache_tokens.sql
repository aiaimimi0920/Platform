ALTER TABLE gateway_request_audits
  ADD COLUMN IF NOT EXISTS cache_creation_input_tokens integer;

ALTER TABLE gateway_request_audits
  ADD COLUMN IF NOT EXISTS cache_read_input_tokens integer;
