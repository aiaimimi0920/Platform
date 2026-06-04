create table if not exists agent_execution_settlements (
  id text primary key,
  execution_id text not null references agent_executions(id) on delete cascade,
  owner_user_id text not null references users(id) on delete cascade,
  agent_id text not null references agents(id) on delete cascade,
  currency text not null,
  billed_cost_units integer not null default 0,
  billed_amount integer not null default 0,
  revenue_recipient_user_id text,
  revenue_amount integer not null default 0,
  status text not null,
  note text,
  last_error text,
  last_attempt_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agent_execution_settlements_execution_idx
  on agent_execution_settlements (execution_id);

create index if not exists agent_execution_settlements_status_idx
  on agent_execution_settlements (status, updated_at);
