alter table arbitration_cases
  add column if not exists task_resolution_action text,
  add column if not exists effects_applied_at timestamptz;
