create table if not exists agent_execution_settlement_line_items (
  id text primary key,
  settlement_id text not null references agent_execution_settlements(id) on delete cascade,
  execution_id text not null references agent_executions(id) on delete cascade,
  owner_user_id text not null references users(id) on delete cascade,
  agent_id text not null references agents(id) on delete cascade,
  line_kind text not null,
  title text not null,
  scope_type text,
  scope_id text,
  cost_units integer not null default 0,
  amount integer not null default 0,
  created_at timestamptz not null
);

create index if not exists agent_execution_settlement_line_items_settlement_idx
  on agent_execution_settlement_line_items(settlement_id, created_at desc);
