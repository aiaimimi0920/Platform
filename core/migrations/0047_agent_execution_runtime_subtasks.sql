alter table agent_execution_subtasks
  add column if not exists managed_by_runtime boolean not null default false;

alter table agent_execution_subtasks
  add column if not exists runtime_phase text;

create index if not exists agent_execution_subtasks_runtime_idx
  on agent_execution_subtasks (execution_id, managed_by_runtime, sort_order);
