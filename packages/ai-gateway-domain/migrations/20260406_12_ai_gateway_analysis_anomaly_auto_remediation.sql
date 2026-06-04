ALTER TABLE gateway_analysis_anomaly_policies
  ADD COLUMN IF NOT EXISTS auto_remediation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_remediation_interval_minutes integer,
  ADD COLUMN IF NOT EXISTS auto_remediation_dry_run_first boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_remediation_action_keys jsonb;

CREATE INDEX IF NOT EXISTS gateway_analysis_anomaly_policies_auto_remediation_status_idx
  ON gateway_analysis_anomaly_policies (auto_remediation_enabled, status);
