alter table item_fulfillment_anomalies
  add column if not exists alert_level integer not null default 0,
  add column if not exists alerted_at timestamptz,
  add column if not exists last_alert_reason text;
