alter table tasks
  add column if not exists pricing_mode text not null default 'flat_task',
  add column if not exists billing_unit text,
  add column if not exists meter_key text,
  add column if not exists operation_mode text not null default 'manual';
