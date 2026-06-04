alter table gateway_analysis_anomaly_policies
  add column if not exists route_policy_id text references gateway_route_policies(id) on delete set null,
  add column if not exists auto_sync_enabled boolean not null default false,
  add column if not exists auto_sync_interval_minutes integer,
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_sync_status text,
  add column if not exists last_sync_error text;

create index if not exists gateway_analysis_anomaly_policies_route_policy_status_idx
  on gateway_analysis_anomaly_policies (route_policy_id, status);
