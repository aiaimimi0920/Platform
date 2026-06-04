alter table item_fulfillment_anomalies
  add column if not exists auto_action_attempt_count integer not null default 0,
  add column if not exists last_auto_action_status text,
  add column if not exists last_auto_action_error text;
