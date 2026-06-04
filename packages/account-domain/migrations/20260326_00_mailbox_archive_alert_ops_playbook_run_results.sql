ALTER TABLE mailbox_archive_alert_ops_playbook_runs
  ADD COLUMN IF NOT EXISTS result_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS result_reason text,
  ADD COLUMN IF NOT EXISTS result_note text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_user_id text REFERENCES users(id);

CREATE INDEX IF NOT EXISTS mailbox_archive_alert_ops_playbook_runs_result_status_idx
  ON mailbox_archive_alert_ops_playbook_runs (operator_user_id, result_status, started_at DESC);
