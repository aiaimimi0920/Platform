alter table agent_execution_callback_remediations
  add column if not exists planned_primary_action text,
  add column if not exists planned_fallback_action text,
  add column if not exists plan_reason_category text,
  add column if not exists plan_reason text,
  add column if not exists fallback_reason text;
