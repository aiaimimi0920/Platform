create table if not exists agent_execution_artifacts (
  id text primary key,
  execution_id text not null references agent_executions(id) on delete cascade,
  kind text not null,
  title text not null,
  url text null,
  summary text null,
  created_at timestamptz not null
);

create index if not exists agent_execution_artifacts_execution_idx
  on agent_execution_artifacts(execution_id, created_at);
