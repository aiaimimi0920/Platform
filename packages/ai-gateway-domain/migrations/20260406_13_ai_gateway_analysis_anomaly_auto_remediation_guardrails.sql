ALTER TABLE gateway_analysis_anomaly_policies
  ADD COLUMN IF NOT EXISTS auto_remediation_max_apply_runs_per_incident integer,
  ADD COLUMN IF NOT EXISTS auto_remediation_require_alert_before_apply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_remediation_freeze_on_provider_health_degrade boolean NOT NULL DEFAULT true;
