create table if not exists agent_execution_callbacks (
  id text primary key,
  execution_id text not null references agent_executions(id) on delete cascade,
  agent_id text not null references agents(id) on delete cascade,
  callback_id text not null,
  callback_type text not null,
  status text not null,
  payload_summary text,
  received_at timestamptz not null
);

create index if not exists agent_execution_callbacks_execution_idx
  on agent_execution_callbacks (execution_id, received_at desc);

create index if not exists agent_execution_callbacks_execution_callback_idx
  on agent_execution_callbacks (execution_id, callback_id, status);
