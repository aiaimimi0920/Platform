create table if not exists mailbox_archive_alert_ops_playbooks (
  id text primary key,
  operator_user_id text not null,
  name text not null,
  description text,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists mailbox_archive_alert_ops_playbooks_owner_name_idx
  on mailbox_archive_alert_ops_playbooks (operator_user_id, name);

create index if not exists mailbox_archive_alert_ops_playbooks_owner_idx
  on mailbox_archive_alert_ops_playbooks (operator_user_id);

create index if not exists mailbox_archive_alert_ops_playbooks_updated_at_idx
  on mailbox_archive_alert_ops_playbooks (updated_at desc);

create table if not exists mailbox_archive_alert_default_playbooks (
  operator_user_id text primary key,
  playbook_id text not null references mailbox_archive_alert_ops_playbooks(id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists mailbox_archive_alert_default_playbooks_playbook_idx
  on mailbox_archive_alert_default_playbooks (playbook_id);

create index if not exists mailbox_archive_alert_default_playbooks_updated_at_idx
  on mailbox_archive_alert_default_playbooks (updated_at desc);
