create table if not exists agents (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  name text not null,
  description text,
  source_type text not null,
  runtime_endpoint text,
  auth_mode text not null,
  enabled boolean not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists agents_owner_name_idx
  on agents(owner_user_id, name);

create table if not exists agent_capabilities (
  id text primary key,
  agent_id text not null references agents(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  input_schema jsonb,
  output_schema jsonb,
  pricing_note text,
  enabled boolean not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists agent_capabilities_agent_code_idx
  on agent_capabilities(agent_id, code);
