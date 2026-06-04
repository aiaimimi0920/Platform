create table if not exists agent_execution_runs (
  id text primary key,
  execution_id text not null references agent_executions(id) on delete cascade,
  agent_id text not null references agents(id) on delete cascade,
  owner_user_id text not null references users(id) on delete cascade,
  run_kind text not null,
  status text not null,
  summary text,
  error_message text,
  artifact_count integer not null default 0,
  created_at timestamptz not null,
  finished_at timestamptz
);

create index if not exists agent_execution_runs_execution_created_idx
  on agent_execution_runs(execution_id, created_at desc);
