alter table outbox_events
  add column if not exists max_attempts integer not null default 5;

alter table outbox_events
  add column if not exists last_error text;
