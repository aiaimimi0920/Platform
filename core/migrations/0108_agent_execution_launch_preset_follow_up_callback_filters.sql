alter table "agent_execution_launch_presets"
  add column if not exists "follow_up_callback_status" text,
  add column if not exists "follow_up_callback_retryability" text;
