alter table agents
  add column if not exists managed_service_id text;
