create table if not exists agent_callback_config_history (
  id text primary key,
  agent_id text not null references agents(id) on delete cascade,
  actor_user_id text not null references users(id) on delete cascade,
  change_type text not null,
  previous_protocol_version integer,
  next_protocol_version integer,
  previous_secret_version integer,
  next_secret_version integer,
  grace_until timestamptz,
  note text,
  created_at timestamptz not null
);

create index if not exists agent_callback_config_history_agent_created_idx
  on agent_callback_config_history(agent_id, created_at desc);
