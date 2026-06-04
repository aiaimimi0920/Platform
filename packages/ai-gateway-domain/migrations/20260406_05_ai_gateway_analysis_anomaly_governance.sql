create table if not exists gateway_analysis_anomaly_policies (
  id text primary key,
  name text not null,
  status text not null default 'enabled',
  project_id text references gateway_projects(id) on delete set null,
  tag text,
  text_mode text,
  profile_key text not null,
  thresholds jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists gateway_analysis_anomaly_policies_project_status_idx
  on gateway_analysis_anomaly_policies (project_id, status);

create index if not exists gateway_analysis_anomaly_policies_status_created_idx
  on gateway_analysis_anomaly_policies (status, created_at);

create table if not exists gateway_analysis_anomaly_incidents (
  id text primary key,
  policy_id text references gateway_analysis_anomaly_policies(id) on delete set null,
  fingerprint text not null,
  project_id text references gateway_projects(id) on delete set null,
  tag text,
  text_mode text,
  code text not null,
  severity text not null,
  status text not null default 'open',
  summary text not null,
  latest_export_id text,
  previous_export_id text,
  latest_value double precision,
  previous_value double precision,
  delta_value double precision,
  delta_ratio double precision,
  threshold_value double precision,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists gateway_analysis_anomaly_incidents_fingerprint_idx
  on gateway_analysis_anomaly_incidents (fingerprint);

create index if not exists gateway_analysis_anomaly_incidents_project_status_idx
  on gateway_analysis_anomaly_incidents (project_id, status);

create index if not exists gateway_analysis_anomaly_incidents_status_severity_idx
  on gateway_analysis_anomaly_incidents (status, severity);

create index if not exists gateway_analysis_anomaly_incidents_code_status_idx
  on gateway_analysis_anomaly_incidents (code, status);
