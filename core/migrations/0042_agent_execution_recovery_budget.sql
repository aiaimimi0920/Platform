alter table agent_executions
  add column if not exists auto_recovery_count integer not null default 0,
  add column if not exists max_auto_recovery_count integer not null default 3,
  add column if not exists recovery_exhausted_at timestamptz;
