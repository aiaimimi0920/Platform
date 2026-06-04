alter table gateway_analysis_anomaly_policies
  add column if not exists alerting_enabled boolean not null default true,
  add column if not exists alert_interval_minutes integer,
  add column if not exists notify_operators_on_escalation boolean not null default true,
  add column if not exists notify_owner_on_escalation boolean not null default true;

create index if not exists gateway_analysis_anomaly_policies_alerting_status_idx
  on gateway_analysis_anomaly_policies (alerting_enabled, status);

alter table gateway_analysis_anomaly_incidents
  add column if not exists last_alert_attempt_at timestamptz,
  add column if not exists last_alerted_at timestamptz,
  add column if not exists last_alert_severity text,
  add column if not exists alert_delivery_count integer not null default 0;

create index if not exists gateway_analysis_anomaly_incidents_escalation_alert_attempt_idx
  on gateway_analysis_anomaly_incidents (escalation_status, status, last_alert_attempt_at);
