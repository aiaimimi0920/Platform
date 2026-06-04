alter table "agent_execution_launch_presets"
  add column if not exists "follow_up_failure_category" text;
