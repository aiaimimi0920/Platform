ALTER TABLE "discount_code_history_export_preset_revisions"
  ADD COLUMN IF NOT EXISTS "reason" text,
  ADD COLUMN IF NOT EXISTS "note" text;
