alter table agents
  add column if not exists external_callback_previous_secret text null;

alter table agents
  add column if not exists external_callback_previous_secret_version integer null;

alter table agents
  add column if not exists external_callback_secret_grace_until timestamptz null;
