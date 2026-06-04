ALTER TABLE "discount_code_history_export_preset_revisions"
  ADD COLUMN IF NOT EXISTS "restored_from_revision_id" text,
  ADD COLUMN IF NOT EXISTS "restored_from_revision_number" integer;
