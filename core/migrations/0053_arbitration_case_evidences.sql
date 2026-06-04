create table if not exists arbitration_case_evidences (
  id text primary key,
  case_id text not null references arbitration_cases(id) on delete cascade,
  creator_user_id text not null references users(id) on delete cascade,
  kind text not null,
  title text not null,
  content text,
  url text,
  created_at timestamptz not null
);

create index if not exists arbitration_case_evidences_case_created_idx
  on arbitration_case_evidences (case_id, created_at);

create index if not exists arbitration_case_evidences_creator_idx
  on arbitration_case_evidences (creator_user_id);
