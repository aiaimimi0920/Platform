create table if not exists gateway_analysis_anomaly_incident_history (
  id text primary key,
  incident_id text not null references gateway_analysis_anomaly_incidents(id) on delete cascade,
  event_type text not null,
  actor_user_id text,
  note text,
  metadata jsonb,
  created_at timestamptz not null
);

create index if not exists gateway_analysis_anomaly_incident_history_incident_created_idx
  on gateway_analysis_anomaly_incident_history (incident_id, created_at);
