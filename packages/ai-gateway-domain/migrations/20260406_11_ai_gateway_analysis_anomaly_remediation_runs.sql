CREATE TABLE IF NOT EXISTS gateway_analysis_anomaly_remediation_runs (
  id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES gateway_analysis_anomaly_incidents(id) ON DELETE CASCADE,
  policy_id text REFERENCES gateway_analysis_anomaly_policies(id) ON DELETE SET NULL,
  route_policy_id text REFERENCES gateway_route_policies(id) ON DELETE SET NULL,
  action_key text NOT NULL,
  title text NOT NULL,
  execution_mode text NOT NULL,
  status text NOT NULL,
  dry_run boolean NOT NULL DEFAULT false,
  actor_user_id text NOT NULL,
  note text,
  input jsonb,
  result jsonb,
  before_incident jsonb,
  after_incident jsonb,
  before_route_policy jsonb,
  after_route_policy jsonb,
  error_summary text,
  created_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS gateway_analysis_anomaly_remediation_runs_incident_created_idx
  ON gateway_analysis_anomaly_remediation_runs (incident_id, created_at);

CREATE INDEX IF NOT EXISTS gateway_analysis_anomaly_remediation_runs_action_status_idx
  ON gateway_analysis_anomaly_remediation_runs (action_key, status, created_at);

CREATE INDEX IF NOT EXISTS gateway_analysis_anomaly_remediation_runs_route_policy_created_idx
  ON gateway_analysis_anomaly_remediation_runs (route_policy_id, created_at);
