alter table agent_execution_runs
  add column if not exists resource_minutes integer not null default 0,
  add column if not exists estimated_amount integer not null default 0;
