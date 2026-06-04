create table if not exists outbox_retry_attempts (
  id text primary key,
  event_id text not null references outbox_events(id) on delete cascade,
  event_name text not null,
  actor_user_id text not null references users(id) on delete cascade,
  previous_status text not null,
  previous_attempts integer not null,
  last_error text,
  retried_at timestamptz not null
);

create index if not exists outbox_retry_attempts_event_idx
  on outbox_retry_attempts (event_id, retried_at desc);
