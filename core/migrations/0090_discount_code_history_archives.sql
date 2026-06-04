CREATE TABLE IF NOT EXISTS discount_code_history_archives (
  id text PRIMARY KEY,
  preset_id text NOT NULL REFERENCES discount_code_history_export_presets (id) ON DELETE CASCADE,
  operator_user_id text NOT NULL,
  archive_path text NOT NULL,
  batch_id text,
  report_template text NOT NULL,
  filters jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS discount_code_history_archives_preset_idx
  ON discount_code_history_archives (preset_id);

CREATE INDEX IF NOT EXISTS discount_code_history_archives_operator_idx
  ON discount_code_history_archives (operator_user_id);

CREATE INDEX IF NOT EXISTS discount_code_history_archives_completed_at_idx
  ON discount_code_history_archives (completed_at DESC);
