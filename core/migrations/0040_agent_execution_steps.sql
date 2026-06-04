create table if not exists agent_execution_steps (
  id text primary key,
  execution_id text not null references agent_executions(id) on delete cascade,
  kind text not null,
  phase text,
  title text not null,
  detail text,
  status text not null,
  progress_percent integer,
  created_at timestamptz not null
);

create index if not exists agent_execution_steps_execution_created_idx
  on agent_execution_steps (execution_id, created_at desc);
