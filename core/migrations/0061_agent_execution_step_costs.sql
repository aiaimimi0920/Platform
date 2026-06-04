alter table agent_execution_steps
  add column if not exists cost_units integer not null default 0;
