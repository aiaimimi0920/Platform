create table if not exists agent_execution_settlement_attempts (
  id text primary key,
  settlement_id text not null references agent_execution_settlements(id) on delete cascade,
  execution_id text not null references agent_executions(id) on delete cascade,
  owner_user_id text not null references users(id) on delete cascade,
  agent_id text not null references agents(id) on delete cascade,
  currency text not null,
  billed_amount integer not null default 0,
  revenue_amount integer not null default 0,
  status text not null,
  note text,
  error text,
  created_at timestamptz not null
);

create index if not exists agent_execution_settlement_attempts_settlement_created_idx
  on agent_execution_settlement_attempts(settlement_id, created_at desc);

create index if not exists agent_execution_settlement_attempts_execution_created_idx
  on agent_execution_settlement_attempts(execution_id, created_at desc);
