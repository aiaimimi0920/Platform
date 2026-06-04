alter table arbitration_evidence_attachments
  add column if not exists cleanup_attempt_count integer not null default 0,
  add column if not exists last_cleanup_attempt_at timestamptz,
  add column if not exists last_cleanup_error text;
