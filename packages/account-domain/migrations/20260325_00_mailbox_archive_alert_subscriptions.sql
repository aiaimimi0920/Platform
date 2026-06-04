CREATE TABLE IF NOT EXISTS "mailbox_archive_alert_subscriptions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_name" text NOT NULL,
  "operator_channel" text,
  "namespace" text,
  "batch_label" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "mailbox_archive_alert_subscriptions_user_idx"
  ON "mailbox_archive_alert_subscriptions" ("user_id");

CREATE INDEX IF NOT EXISTS "mailbox_archive_alert_subscriptions_event_idx"
  ON "mailbox_archive_alert_subscriptions" ("event_name");

CREATE INDEX IF NOT EXISTS "mailbox_archive_alert_subscriptions_scope_idx"
  ON "mailbox_archive_alert_subscriptions" ("event_name", "operator_channel", "namespace", "batch_label");
