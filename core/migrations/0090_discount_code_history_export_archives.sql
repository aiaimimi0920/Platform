ALTER TABLE discount_code_history_export_presets
  ADD COLUMN IF NOT EXISTS archive_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archive_interval_hours integer,
  ADD COLUMN IF NOT EXISTS archive_retention_days integer,
  ADD COLUMN IF NOT EXISTS archive_failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_archive_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_archive_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_archive_error text;

CREATE INDEX IF NOT EXISTS discount_code_history_export_presets_next_archive_at_idx
  ON discount_code_history_export_presets (next_archive_at);

CREATE TABLE IF NOT EXISTS discount_code_history_export_archives (
  id text PRIMARY KEY,
  preset_id text NOT NULL REFERENCES discount_code_history_export_presets (id) ON DELETE CASCADE,
  operator_user_id text NOT NULL,
  preset_name text NOT NULL,
  report_template text NOT NULL,
  batch_id text,
  object_key text NOT NULL,
  download_url text,
  file_name text NOT NULL,
  row_count integer NOT NULL,
  size_bytes integer NOT NULL,
  trigger text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discount_code_history_export_archives_preset_idx
  ON discount_code_history_export_archives (preset_id);

CREATE INDEX IF NOT EXISTS discount_code_history_export_archives_operator_idx
  ON discount_code_history_export_archives (operator_user_id);

CREATE INDEX IF NOT EXISTS discount_code_history_export_archives_created_at_idx
  ON discount_code_history_export_archives (created_at DESC);
