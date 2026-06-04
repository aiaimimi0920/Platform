alter table agent_execution_callbacks
  add column if not exists used_previous_protocol boolean not null default false,
  add column if not exists used_previous_secret boolean not null default false;
