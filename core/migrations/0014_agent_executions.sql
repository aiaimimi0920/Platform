create table if not exists agent_executions (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  agent_id text not null references agents(id) on delete cascade,
  task_id text null,
  title text not null,
  objective text not null,
  status text not null,
  status_note text null,
  result_summary text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  started_at timestamptz null,
  submitted_at timestamptz null,
  completed_at timestamptz null
);
