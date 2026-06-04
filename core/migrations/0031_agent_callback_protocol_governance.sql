alter table agents
  add column if not exists external_callback_protocol_version integer not null default 1;

alter table agents
  add column if not exists external_callback_secret_version integer not null default 1;

alter table agent_execution_callbacks
  add column if not exists callback_version integer not null default 1;

alter table agent_execution_callbacks
  add column if not exists secret_version integer not null default 1;

alter table agent_execution_callbacks
  add column if not exists callback_timestamp timestamptz null;
