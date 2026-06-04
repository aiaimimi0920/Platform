alter table agent_execution_settlements
  add column if not exists runtime_profile_key text not null default 'baseline',
  add column if not exists cost_units_per_currency integer not null default 10,
  add column if not exists revenue_share_percent integer not null default 100;
