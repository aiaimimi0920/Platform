alter table arbitration_evidence_attachments
  add column if not exists storage_policy_key text,
  add column if not exists prepared_upload_expires_at timestamptz,
  add column if not exists next_cleanup_attempt_at timestamptz;
