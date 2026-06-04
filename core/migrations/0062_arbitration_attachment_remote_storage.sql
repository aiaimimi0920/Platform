alter table arbitration_evidence_attachments
  add column if not exists storage_mode text not null default 'local',
  add column if not exists object_key text,
  add column if not exists remote_url text;
