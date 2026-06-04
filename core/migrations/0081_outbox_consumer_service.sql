alter table outbox_events
  add column if not exists consumer_service text not null default 'platform';

create index if not exists outbox_events_consumer_service_status_available_idx
  on outbox_events (consumer_service, status, available_at, created_at);
