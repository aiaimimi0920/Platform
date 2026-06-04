alter table agent_executions
  add column if not exists task_id text null;
