create table if not exists mailbox_archive_alert_ops_playbook_runs (
  id text primary key,
  playbook_id text not null references mailbox_archive_alert_ops_playbooks(id) on delete cascade,
  operator_user_id text not null,
  focus text not null,
  source text,
  run_window text,
  action_intent text,
  opening_summary jsonb not null,
  latest_summary jsonb not null,
  action_count integer not null,
  started_at timestamptz not null,
  last_action_at timestamptz,
  updated_at timestamptz not null
);

create index if not exists mailbox_archive_alert_ops_playbook_runs_playbook_idx
  on mailbox_archive_alert_ops_playbook_runs (playbook_id, started_at desc);

create index if not exists mailbox_archive_alert_ops_playbook_runs_operator_idx
  on mailbox_archive_alert_ops_playbook_runs (operator_user_id, started_at desc);

create table if not exists mailbox_archive_alert_ops_playbook_run_actions (
  id text primary key,
  run_id text not null references mailbox_archive_alert_ops_playbook_runs(id) on delete cascade,
  playbook_id text not null references mailbox_archive_alert_ops_playbooks(id) on delete cascade,
  operator_user_id text not null,
  action_kind text not null,
  status text not null,
  title text not null,
  detail text,
  affected_count integer,
  failed_count integer,
  summary jsonb not null,
  created_at timestamptz not null
);

create index if not exists mailbox_archive_alert_ops_playbook_run_actions_run_idx
  on mailbox_archive_alert_ops_playbook_run_actions (run_id, created_at desc);

create index if not exists mailbox_archive_alert_ops_playbook_run_actions_playbook_idx
  on mailbox_archive_alert_ops_playbook_run_actions (playbook_id, created_at desc);
