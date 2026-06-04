alter table agent_execution_callbacks
  add column if not exists auto_remediation_attempts integer not null default 0,
  add column if not exists last_auto_remediation_at timestamptz,
  add column if not exists next_auto_remediation_at timestamptz,
  add column if not exists auto_remediation_exhausted_at timestamptz,
  add column if not exists auto_remediation_last_error text;

create index if not exists idx_agent_execution_callbacks_auto_remediation_due
  on agent_execution_callbacks (status, next_auto_remediation_at, auto_remediation_exhausted_at, received_at desc);
