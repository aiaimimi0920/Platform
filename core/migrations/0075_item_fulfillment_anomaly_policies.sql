alter table item_fulfillment_anomalies
  add column if not exists policy_key text,
  add column if not exists escalation_strategy text,
  add column if not exists next_escalation_at timestamptz;
