alter table arbitration_evidence_attachments
  add column if not exists verified_at timestamptz;

alter table arbitration_evidence_attachments
  add column if not exists verified_size_bytes integer;

alter table arbitration_evidence_attachments
  add column if not exists verified_content_type text;
