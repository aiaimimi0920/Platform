CREATE TABLE IF NOT EXISTS mailbox_archive_alert_handoff_default_playbooks (
  operator_user_id text NOT NULL REFERENCES users(id),
  handoff_target_type text NOT NULL,
  playbook_id text NOT NULL REFERENCES mailbox_archive_alert_ops_playbooks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (operator_user_id, handoff_target_type)
);

CREATE INDEX IF NOT EXISTS mailbox_archive_alert_handoff_default_playbooks_playbook_idx
  ON mailbox_archive_alert_handoff_default_playbooks (playbook_id);
