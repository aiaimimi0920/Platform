alter table agents
  add column if not exists hosting_mode text not null default 'registry_only',
  add column if not exists managed_provider_label text,
  add column if not exists managed_api_base_url text,
  add column if not exists managed_model text,
  add column if not exists managed_api_key text,
  add column if not exists managed_prompt_template text;

create table if not exists agent_marketplace_listings (
  id text primary key,
  agent_id text not null references agents(id) on delete cascade,
  capability_id text not null references agent_capabilities(id) on delete cascade,
  public_title text not null,
  public_description text,
  billing_mode text not null default 'flat_task',
  billing_unit text,
  meter_key text,
  price_currency text not null,
  price_amount integer not null,
  status text not null default 'draft',
  external_invocation_enabled boolean not null default false,
  auto_take_enabled boolean not null default false,
  auto_take_statement_template text,
  last_auto_proposal_sweep_at timestamptz,
  last_auto_proposal_created_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists agent_marketplace_listings_capability_idx
  on agent_marketplace_listings(capability_id);
