alter table "agent_execution_launch_presets"
  add column if not exists "follow_up_callback_type" text,
  add column if not exists "follow_up_callback_rejection_category" text;
