create table if not exists notification_webhook_incident_saved_views (
  id text primary key,
  operator_user_id text not null,
  name text not null,
  description text,
  filters jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists notification_webhook_incident_saved_views_owner_name_idx
  on notification_webhook_incident_saved_views (operator_user_id, name);

create index if not exists notification_webhook_incident_saved_views_owner_idx
  on notification_webhook_incident_saved_views (operator_user_id);

create index if not exists notification_webhook_incident_saved_views_created_at_idx
  on notification_webhook_incident_saved_views (created_at desc);

create index if not exists notification_webhook_incident_saved_views_updated_at_idx
  on notification_webhook_incident_saved_views (updated_at desc);

create table if not exists notification_webhook_incident_default_views (
  operator_user_id text primary key,
  saved_view_id text not null references notification_webhook_incident_saved_views(id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists notification_webhook_incident_default_views_saved_view_idx
  on notification_webhook_incident_default_views (saved_view_id);

create index if not exists notification_webhook_incident_default_views_updated_at_idx
  on notification_webhook_incident_default_views (updated_at desc);
