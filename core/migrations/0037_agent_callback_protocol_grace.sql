alter table agents
  add column if not exists external_callback_previous_protocol_version integer,
  add column if not exists external_callback_protocol_grace_until timestamptz;
