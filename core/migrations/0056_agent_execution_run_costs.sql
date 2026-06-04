alter table agent_execution_runs
  add column if not exists cost_units integer not null default 0;
