alter table mailbox_archive_alert_digests
  add column if not exists dismissed_at timestamptz;

alter table mailbox_archive_alert_digests
  add column if not exists dismissed_by_user_id text references users(id);

alter table mailbox_archive_alert_digests
  add column if not exists last_flush_attempt_at timestamptz;

alter table mailbox_archive_alert_digests
  add column if not exists last_flush_error text;

create index if not exists mailbox_archive_alert_digests_open_idx
  on mailbox_archive_alert_digests (user_id, due_at desc)
  where flushed_at is null and dismissed_at is null;
