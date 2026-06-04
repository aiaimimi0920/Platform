CREATE TABLE IF NOT EXISTS discount_code_history_export_archive_cleanup_runs (
  id text PRIMARY KEY,
  operator_user_id text,
  trigger text NOT NULL,
  limit_applied integer,
  scanned_count integer NOT NULL,
  deleted_count integer NOT NULL,
  failed_count integer NOT NULL,
  deleted_archive_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discount_code_history_export_archive_cleanup_runs_operator_idx
  ON discount_code_history_export_archive_cleanup_runs (operator_user_id);

CREATE INDEX IF NOT EXISTS discount_code_history_export_archive_cleanup_runs_trigger_idx
  ON discount_code_history_export_archive_cleanup_runs (trigger);

CREATE INDEX IF NOT EXISTS discount_code_history_export_archive_cleanup_runs_created_at_idx
  ON discount_code_history_export_archive_cleanup_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS discount_code_history_export_archive_cleanup_runs_finished_at_idx
  ON discount_code_history_export_archive_cleanup_runs (finished_at DESC);
