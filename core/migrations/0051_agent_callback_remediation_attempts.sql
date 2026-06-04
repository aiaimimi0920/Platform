create table if not exists agent_execution_callback_remediations (
  id text primary key,
  callback_audit_id text not null references agent_execution_callbacks(id) on delete cascade,
  execution_id text not null references agent_executions(id) on delete cascade,
  agent_id text not null references agents(id) on delete cascade,
  run_id text references agent_execution_runs(id) on delete set null,
  actor_user_id text not null,
  mode text not null,
  status text not null,
  note text,
  error_message text,
  created_at timestamptz not null,
  finished_at timestamptz
);

create index if not exists agent_execution_callback_remediations_callback_idx
  on agent_execution_callback_remediations(callback_audit_id, created_at desc);

create index if not exists agent_execution_callback_remediations_execution_idx
  on agent_execution_callback_remediations(execution_id, created_at desc);
