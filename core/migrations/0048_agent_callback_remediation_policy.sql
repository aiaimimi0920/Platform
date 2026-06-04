alter table agents
  add column if not exists external_callback_remediation_policy text not null default 'balanced';
