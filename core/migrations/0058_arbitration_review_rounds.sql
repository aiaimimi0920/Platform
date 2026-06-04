create table if not exists arbitration_case_review_rounds (
  id text primary key,
  case_id text not null references arbitration_cases(id) on delete cascade,
  round_number integer not null,
  status text not null,
  summary text,
  assigned_operator_user_id text references users(id) on delete set null,
  started_by_user_id text references users(id) on delete set null,
  ended_by_user_id text references users(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz
);

create unique index if not exists arbitration_case_review_rounds_case_round_idx
  on arbitration_case_review_rounds(case_id, round_number);

create index if not exists arbitration_case_review_rounds_case_started_idx
  on arbitration_case_review_rounds(case_id, started_at);
