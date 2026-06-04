ALTER TABLE gateway_analysis_anomaly_incidents
  ADD COLUMN IF NOT EXISTS route_policy_id text REFERENCES gateway_route_policies (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gateway_analysis_anomaly_incidents_route_policy_status_idx
  ON gateway_analysis_anomaly_incidents (route_policy_id, status);
