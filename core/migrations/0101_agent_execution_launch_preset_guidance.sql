alter table "agent_execution_launch_presets"
  add column if not exists "launch_guidance" text;
