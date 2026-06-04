alter table agent_execution_settlements
  add column if not exists revenue_contract_key text not null default 'default',
  add column if not exists revenue_contract_version integer not null default 1,
  add column if not exists revenue_recipient_mode text not null default 'agent_owner';
