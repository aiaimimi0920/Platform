alter table gateway_analysis_anomaly_policies
  add column if not exists auto_escalate_enabled boolean not null default false,
  add column if not exists escalate_severity_threshold text,
  add column if not exists escalate_after_sync_count integer,
  add column if not exists auto_escalate_owner_user_id text,
  add column if not exists auto_escalate_follow_up_status text;

create index if not exists gateway_analysis_anomaly_policies_auto_escalate_status_idx
  on gateway_analysis_anomaly_policies (auto_escalate_enabled, status);

alter table gateway_analysis_anomaly_incidents
  add column if not exists sync_hit_count integer not null default 0,
  add column if not exists escalation_status text not null default 'none',
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_reason text;

create index if not exists gateway_analysis_anomaly_incidents_escalation_status_idx
  on gateway_analysis_anomaly_incidents (escalation_status, status);
