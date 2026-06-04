create table if not exists agent_execution_owner_relief_runs (
  id text primary key,
  operator_user_id text not null references users(id),
  owner_user_id text not null references users(id),
  agent_id text,
  trigger_action text,
  source text,
  runtime_pressure_level text,
  runtime_scheduling_decision_class text,
  opening_summary jsonb not null,
  latest_summary jsonb not null,
  action_count integer not null,
  result_status text not null default 'active',
  result_note text,
  completed_at timestamptz,
  completed_by_user_id text references users(id),
  started_at timestamptz not null,
  last_action_at timestamptz,
  updated_at timestamptz not null
);

create index if not exists agent_execution_owner_relief_runs_operator_started_idx
  on agent_execution_owner_relief_runs (operator_user_id, started_at desc);

create index if not exists agent_execution_owner_relief_runs_owner_started_idx
  on agent_execution_owner_relief_runs (owner_user_id, started_at desc);

create index if not exists agent_execution_owner_relief_runs_result_status_idx
  on agent_execution_owner_relief_runs (operator_user_id, result_status, started_at desc);

create index if not exists agent_execution_owner_relief_runs_agent_idx
  on agent_execution_owner_relief_runs (agent_id, started_at desc);

create table if not exists agent_execution_owner_relief_run_actions (
  id text primary key,
  run_id text not null references agent_execution_owner_relief_runs(id) on delete cascade,
  operator_user_id text not null references users(id),
  action_kind text not null,
  status text not null,
  title text not null,
  detail text,
  summary jsonb not null,
  created_at timestamptz not null
);

create index if not exists agent_execution_owner_relief_run_actions_run_idx
  on agent_execution_owner_relief_run_actions (run_id, created_at desc);

create index if not exists agent_execution_owner_relief_run_actions_operator_idx
  on agent_execution_owner_relief_run_actions (operator_user_id, created_at desc);
