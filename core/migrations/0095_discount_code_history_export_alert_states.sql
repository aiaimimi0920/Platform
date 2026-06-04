CREATE TABLE IF NOT EXISTS "discount_code_history_export_alert_states" (
  "id" text PRIMARY KEY,
  "scope_type" text NOT NULL,
  "scope_key" text NOT NULL,
  "acknowledged_at" timestamptz,
  "acknowledged_by_user_id" text,
  "silenced_until" timestamptz,
  "last_notified_at" timestamptz,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "discount_code_history_export_alert_states_scope_idx"
  ON "discount_code_history_export_alert_states" ("scope_type", "scope_key");

CREATE INDEX IF NOT EXISTS "discount_code_history_export_alert_states_scope_type_idx"
  ON "discount_code_history_export_alert_states" ("scope_type");

CREATE INDEX IF NOT EXISTS "discount_code_history_export_alert_states_silenced_until_idx"
  ON "discount_code_history_export_alert_states" ("silenced_until");

CREATE INDEX IF NOT EXISTS "discount_code_history_export_alert_states_updated_at_idx"
  ON "discount_code_history_export_alert_states" ("updated_at");
