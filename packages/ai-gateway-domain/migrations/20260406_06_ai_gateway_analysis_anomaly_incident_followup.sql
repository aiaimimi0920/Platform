alter table gateway_analysis_anomaly_incidents
  add column if not exists owner_user_id text,
  add column if not exists follow_up_status text not null default 'pending',
  add column if not exists latest_note text,
  add column if not exists resolution_note text,
  add column if not exists last_action_at timestamptz;

create index if not exists gateway_analysis_anomaly_incidents_owner_follow_up_idx
  on gateway_analysis_anomaly_incidents (owner_user_id, follow_up_status);
