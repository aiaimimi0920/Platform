ALTER TABLE mailbox_archive_alert_ops_playbook_runs
  ADD COLUMN IF NOT EXISTS handoff_target text,
  ADD COLUMN IF NOT EXISTS reopened_from_run_id text,
  ADD COLUMN IF NOT EXISTS superseded_by_run_id text;

CREATE INDEX IF NOT EXISTS mailbox_archive_alert_ops_playbook_runs_reopened_from_idx
  ON mailbox_archive_alert_ops_playbook_runs (reopened_from_run_id);

CREATE INDEX IF NOT EXISTS mailbox_archive_alert_ops_playbook_runs_superseded_by_idx
  ON mailbox_archive_alert_ops_playbook_runs (superseded_by_run_id);
