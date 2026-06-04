CREATE TABLE IF NOT EXISTS discount_code_history_export_preset_revisions (
  id text PRIMARY KEY,
  preset_id text NOT NULL REFERENCES discount_code_history_export_presets (id) ON DELETE CASCADE,
  operator_user_id text NOT NULL,
  revision_number integer NOT NULL,
  action text NOT NULL,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS discount_code_history_export_preset_revisions_preset_revision_idx
  ON discount_code_history_export_preset_revisions (preset_id, revision_number);

CREATE INDEX IF NOT EXISTS discount_code_history_export_preset_revisions_preset_idx
  ON discount_code_history_export_preset_revisions (preset_id);

CREATE INDEX IF NOT EXISTS discount_code_history_export_preset_revisions_operator_idx
  ON discount_code_history_export_preset_revisions (operator_user_id);

CREATE INDEX IF NOT EXISTS discount_code_history_export_preset_revisions_created_at_idx
  ON discount_code_history_export_preset_revisions (created_at DESC);
