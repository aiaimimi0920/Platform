alter table "agent_execution_launch_presets"
  add column if not exists "follow_up_recent_window" text;
