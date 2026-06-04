ALTER TABLE "mailbox_archive_alert_subscriptions"
  ADD COLUMN IF NOT EXISTS "delivery_mode" text NOT NULL DEFAULT 'immediate';

ALTER TABLE "mailbox_archive_alert_subscriptions"
  ADD COLUMN IF NOT EXISTS "digest_window_minutes" integer;

ALTER TABLE "mailbox_archive_alert_subscriptions"
  ADD COLUMN IF NOT EXISTS "escalate_after_count" integer;

CREATE TABLE IF NOT EXISTS "mailbox_archive_alert_digests" (
  "id" text PRIMARY KEY,
  "subscription_id" text NOT NULL REFERENCES "mailbox_archive_alert_subscriptions"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_name" text NOT NULL,
  "delivery_mode" text NOT NULL,
  "operator_channel" text,
  "namespace" text,
  "batch_label" text,
  "event_count" integer NOT NULL,
  "max_failure_count" integer NOT NULL,
  "latest_title" text NOT NULL,
  "latest_message" text NOT NULL,
  "due_at" timestamptz NOT NULL,
  "flushed_at" timestamptz,
  "window_started_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "mailbox_archive_alert_digests_subscription_idx"
  ON "mailbox_archive_alert_digests" ("subscription_id");

CREATE INDEX IF NOT EXISTS "mailbox_archive_alert_digests_due_idx"
  ON "mailbox_archive_alert_digests" ("due_at", "flushed_at");

CREATE INDEX IF NOT EXISTS "mailbox_archive_alert_digests_user_idx"
  ON "mailbox_archive_alert_digests" ("user_id", "updated_at");
