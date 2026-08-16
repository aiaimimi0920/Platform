alter table arbitration_evidence_attachments
  add column if not exists cleanup_lease_token text;

alter table arbitration_evidence_attachments
  add column if not exists cleanup_lease_expires_at timestamptz;

create index if not exists arbitration_evidence_attachments_cleanup_due_idx
  on arbitration_evidence_attachments (
    storage_mode,
    upload_state,
    next_cleanup_attempt_at,
    cleanup_lease_expires_at,
    created_at
  )
  where archived_at is null;
