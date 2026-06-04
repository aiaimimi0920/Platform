alter table agent_execution_settlements
  add column if not exists pricing_policy_key text not null default 'default',
  add column if not exists pricing_policy_version integer not null default 1,
  add column if not exists treasury_user_id text not null default 'system:agent-execution-treasury';
