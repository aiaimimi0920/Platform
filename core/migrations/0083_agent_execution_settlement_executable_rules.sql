alter table agent_execution_settlements
  add column if not exists measured_cost_units integer not null default 0,
  add column if not exists included_cost_units integer not null default 0,
  add column if not exists minimum_billed_amount integer not null default 0,
  add column if not exists minimum_payout_amount integer not null default 0;
