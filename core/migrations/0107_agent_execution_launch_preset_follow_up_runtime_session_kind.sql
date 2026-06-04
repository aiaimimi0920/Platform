alter table "agent_execution_launch_presets"
  add column if not exists "follow_up_runtime_session_kind" text;
