alter table arbitration_evidence_attachments
  add column if not exists upload_state text not null default 'uploaded',
  add column if not exists upload_prepared_at timestamptz,
  add column if not exists upload_completed_at timestamptz;

update arbitration_evidence_attachments
set
  upload_state = coalesce(upload_state, 'uploaded'),
  upload_completed_at = coalesce(upload_completed_at, created_at)
where upload_state is distinct from 'uploaded'
   or upload_completed_at is null;
