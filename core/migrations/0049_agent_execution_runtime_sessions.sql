create table if not exists agent_execution_runtime_sessions (
  id text primary key,
  execution_id text not null references agent_executions(id) on delete cascade,
  run_id text,
  agent_id text not null references agents(id) on delete cascade,
  owner_user_id text not null references users(id) on delete cascade,
  kind text not null,
  state text not null,
  trigger text not null,
  started_phase text,
  ended_phase text,
  note text,
  started_at timestamptz not null,
  ended_at timestamptz,
  updated_at timestamptz not null
);

create index if not exists idx_agent_execution_runtime_sessions_execution_id
  on agent_execution_runtime_sessions (execution_id, started_at desc);

create index if not exists idx_agent_execution_runtime_sessions_open
  on agent_execution_runtime_sessions (execution_id, ended_at);
