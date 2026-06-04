create table if not exists arbitration_cases (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  requester_user_id text not null references users(id) on delete cascade,
  respondent_user_id text not null references users(id) on delete cascade,
  status text not null,
  reason text not null,
  evidence_summary text null,
  resolution_summary text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  resolved_at timestamptz null
);

create unique index if not exists arbitration_cases_entity_status_idx
  on arbitration_cases(entity_type, entity_id, status);
