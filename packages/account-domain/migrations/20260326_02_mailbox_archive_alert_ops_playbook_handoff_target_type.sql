ALTER TABLE mailbox_archive_alert_ops_playbook_runs
  ADD COLUMN IF NOT EXISTS handoff_target_type text;

CREATE INDEX IF NOT EXISTS mailbox_archive_alert_ops_playbook_runs_handoff_target_type_idx
  ON mailbox_archive_alert_ops_playbook_runs (operator_user_id, handoff_target_type, started_at DESC)
  WHERE handoff_target_type IS NOT NULL;
