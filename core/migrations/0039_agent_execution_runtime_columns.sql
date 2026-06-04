alter table agent_executions
  add column if not exists executor_phase text,
  add column if not exists progress_percent integer;
