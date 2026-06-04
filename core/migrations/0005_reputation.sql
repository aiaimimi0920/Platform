create table if not exists reputation_snapshots (
  user_id text primary key references users(id) on delete cascade,
  reputation_score integer not null,
  completed_task_count integer not null,
  defaulted_task_count integer not null,
  cancelled_task_count integer not null,
  active_task_count integer not null,
  completion_rate real not null,
  default_rate real not null,
  tier text not null,
  updated_at timestamptz not null
);
