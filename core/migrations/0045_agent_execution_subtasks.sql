create table if not exists agent_execution_subtasks (
  id text primary key,
  execution_id text not null references agent_executions(id) on delete cascade,
  parent_subtask_id text,
  title text not null,
  detail text,
  status text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz
);

create index if not exists agent_execution_subtasks_execution_created_idx
  on agent_execution_subtasks (execution_id, created_at);

create index if not exists agent_execution_subtasks_execution_sort_idx
  on agent_execution_subtasks (execution_id, sort_order, created_at);
