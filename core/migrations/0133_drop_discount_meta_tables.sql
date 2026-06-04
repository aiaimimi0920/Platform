-- Drop discount code meta-system tables (audit/archive/alert/export/batch)
DROP TABLE IF EXISTS discount_code_history_export_archive_cleanup_runs CASCADE;
DROP TABLE IF EXISTS discount_code_history_export_archives CASCADE;
DROP TABLE IF EXISTS discount_code_history_export_alert_states CASCADE;
DROP TABLE IF EXISTS discount_code_history_export_preset_revisions CASCADE;
DROP TABLE IF EXISTS discount_code_history_default_export_presets CASCADE;
DROP TABLE IF EXISTS discount_code_history_export_presets CASCADE;
DROP TABLE IF EXISTS discount_code_history_default_views CASCADE;
DROP TABLE IF EXISTS discount_code_history_saved_views CASCADE;
DROP TABLE IF EXISTS discount_code_generated_batch_items CASCADE;
DROP TABLE IF EXISTS discount_code_generated_batches CASCADE;
