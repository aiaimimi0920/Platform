create table if not exists arbitration_evidence_attachments (
  id text primary key,
  evidence_id text not null references arbitration_case_evidences(id) on delete cascade,
  case_id text not null references arbitration_cases(id) on delete cascade,
  uploader_user_id text not null references users(id) on delete cascade,
  file_name text not null,
  content_type text not null,
  size_bytes integer not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists arbitration_evidence_attachments_evidence_created_idx
  on arbitration_evidence_attachments (evidence_id, created_at);

create index if not exists arbitration_evidence_attachments_case_created_idx
  on arbitration_evidence_attachments (case_id, created_at);
