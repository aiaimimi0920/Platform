create table if not exists mailbox_archive_alert_digest_flush_runs (
  id text primary key,
  trigger text not null,
  operator_user_id text references users(id),
  requested_limit integer not null,
  scanned_count integer not null,
  flushed_count integer not null,
  failed_count integer not null,
  error_message text,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  created_at timestamptz not null
);

create index if not exists mailbox_archive_alert_digest_flush_runs_created_at_idx
  on mailbox_archive_alert_digest_flush_runs (created_at desc);

create index if not exists mailbox_archive_alert_digest_flush_runs_trigger_idx
  on mailbox_archive_alert_digest_flush_runs (trigger, created_at desc);
