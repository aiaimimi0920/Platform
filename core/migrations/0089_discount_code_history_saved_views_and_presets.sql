CREATE TABLE IF NOT EXISTS discount_code_history_saved_views (
  id text PRIMARY KEY,
  operator_user_id text NOT NULL,
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS discount_code_history_saved_views_owner_name_idx
  ON discount_code_history_saved_views (operator_user_id, name);

CREATE INDEX IF NOT EXISTS discount_code_history_saved_views_owner_idx
  ON discount_code_history_saved_views (operator_user_id);

CREATE INDEX IF NOT EXISTS discount_code_history_saved_views_created_at_idx
  ON discount_code_history_saved_views (created_at DESC);

CREATE INDEX IF NOT EXISTS discount_code_history_saved_views_updated_at_idx
  ON discount_code_history_saved_views (updated_at DESC);

CREATE TABLE IF NOT EXISTS discount_code_history_export_presets (
  id text PRIMARY KEY,
  operator_user_id text NOT NULL,
  name text NOT NULL,
  description text,
  report_template text NOT NULL,
  batch_id text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS discount_code_history_export_presets_owner_name_idx
  ON discount_code_history_export_presets (operator_user_id, name);

CREATE INDEX IF NOT EXISTS discount_code_history_export_presets_owner_idx
  ON discount_code_history_export_presets (operator_user_id);

CREATE INDEX IF NOT EXISTS discount_code_history_export_presets_report_template_idx
  ON discount_code_history_export_presets (report_template);

CREATE INDEX IF NOT EXISTS discount_code_history_export_presets_created_at_idx
  ON discount_code_history_export_presets (created_at DESC);

CREATE INDEX IF NOT EXISTS discount_code_history_export_presets_updated_at_idx
  ON discount_code_history_export_presets (updated_at DESC);

CREATE TABLE IF NOT EXISTS discount_code_history_default_views (
  operator_user_id text PRIMARY KEY,
  saved_view_id text NOT NULL REFERENCES discount_code_history_saved_views (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discount_code_history_default_views_saved_view_idx
  ON discount_code_history_default_views (saved_view_id);

CREATE INDEX IF NOT EXISTS discount_code_history_default_views_updated_at_idx
  ON discount_code_history_default_views (updated_at DESC);

CREATE TABLE IF NOT EXISTS discount_code_history_default_export_presets (
  operator_user_id text PRIMARY KEY,
  preset_id text NOT NULL REFERENCES discount_code_history_export_presets (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discount_code_history_default_export_presets_preset_idx
  ON discount_code_history_default_export_presets (preset_id);

CREATE INDEX IF NOT EXISTS discount_code_history_default_export_presets_updated_at_idx
  ON discount_code_history_default_export_presets (updated_at DESC);
