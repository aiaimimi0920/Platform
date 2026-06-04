alter table arbitration_evidence_attachments
  add column if not exists retention_expires_at timestamptz,
  add column if not exists cleanup_requested_at timestamptz;
