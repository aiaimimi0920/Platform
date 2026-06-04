alter table arbitration_evidence_attachments
  add column if not exists bucket_key text;
