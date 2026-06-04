create table if not exists mailbox_ops_campaigns (
  id text primary key,
  operator_label text not null,
  title text not null,
  summary text,
  body text not null,
  type text not null,
  source_label text,
  recipient_mode text not null,
  recipient_input text,
  attachments jsonb not null,
  preview_recipient_count integer not null,
  preview_unresolved_count integer not null,
  preview_unresolved_targets jsonb not null,
  target_count integer not null,
  sent_count integer not null,
  failed_count integer not null,
  status text not null,
  expires_at timestamptz,
  scheduled_at timestamptz,
  last_dispatched_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_by_user_id text not null references users(id),
  updated_by_user_id text not null references users(id),
  dispatched_by_user_id text references users(id),
  canceled_by_user_id text references users(id),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists mailbox_ops_campaigns_status_scheduled_idx
  on mailbox_ops_campaigns(status, scheduled_at asc, created_at asc);

create index if not exists mailbox_ops_campaigns_updated_at_idx
  on mailbox_ops_campaigns(updated_at desc, created_at desc);

create index if not exists mailbox_ops_campaigns_created_by_idx
  on mailbox_ops_campaigns(created_by_user_id, created_at desc);

create table if not exists mailbox_ops_campaign_deliveries (
  id text primary key,
  campaign_id text not null references mailbox_ops_campaigns(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  username_snapshot text,
  provider_user_id_snapshot text,
  message_id text references mailbox_messages(id) on delete set null,
  status text not null,
  error_message text,
  created_at timestamptz not null,
  sent_at timestamptz
);

create unique index if not exists mailbox_ops_campaign_deliveries_campaign_user_idx
  on mailbox_ops_campaign_deliveries(campaign_id, user_id);

create index if not exists mailbox_ops_campaign_deliveries_campaign_created_idx
  on mailbox_ops_campaign_deliveries(campaign_id, created_at desc);
