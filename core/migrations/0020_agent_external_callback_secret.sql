alter table agents
  add column if not exists external_callback_secret text null;
