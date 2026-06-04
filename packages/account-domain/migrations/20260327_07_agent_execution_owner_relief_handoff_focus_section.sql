ALTER TABLE agent_execution_owner_relief_handoff_defaults
  ADD COLUMN IF NOT EXISTS follow_up_focus_section text;

ALTER TABLE agent_execution_owner_relief_handoff_defaults
  ADD COLUMN IF NOT EXISTS follow_up_profile text;

ALTER TABLE agent_execution_owner_relief_run_handoffs
  ADD COLUMN IF NOT EXISTS follow_up_focus_section text;

ALTER TABLE agent_execution_owner_relief_run_handoffs
  ADD COLUMN IF NOT EXISTS follow_up_profile text;
