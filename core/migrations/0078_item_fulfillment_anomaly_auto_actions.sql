alter table item_fulfillment_anomalies
  add column if not exists auto_action text not null default 'none',
  add column if not exists auto_action_template_key text,
  add column if not exists next_alert_eligible_at timestamptz,
  add column if not exists last_auto_action text,
  add column if not exists last_auto_action_at timestamptz;
