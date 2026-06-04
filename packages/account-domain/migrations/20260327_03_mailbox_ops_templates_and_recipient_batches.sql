create table if not exists mailbox_ops_templates (
  id text primary key,
  operator_user_id text not null references users(id) on delete cascade,
  name text not null,
  description text,
  operator_label text not null,
  title text not null,
  summary text,
  body text not null,
  type text not null,
  source_label text,
  attachments jsonb not null,
  expires_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists mailbox_ops_templates_operator_name_idx
  on mailbox_ops_templates(operator_user_id, name);

create index if not exists mailbox_ops_templates_updated_at_idx
  on mailbox_ops_templates(operator_user_id, updated_at desc, created_at desc);

create table if not exists mailbox_ops_recipient_batches (
  id text primary key,
  operator_user_id text not null references users(id) on delete cascade,
  name text not null,
  description text,
  recipient_mode text not null,
  recipient_input text,
  preview_recipient_count integer not null,
  preview_unresolved_count integer not null,
  preview_unresolved_targets jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists mailbox_ops_recipient_batches_operator_name_idx
  on mailbox_ops_recipient_batches(operator_user_id, name);

create index if not exists mailbox_ops_recipient_batches_updated_at_idx
  on mailbox_ops_recipient_batches(operator_user_id, updated_at desc, created_at desc);
