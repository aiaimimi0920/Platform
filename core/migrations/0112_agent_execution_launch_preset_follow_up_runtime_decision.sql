ALTER TABLE agent_execution_launch_presets
  ADD COLUMN IF NOT EXISTS follow_up_runtime_decision_class text,
  ADD COLUMN IF NOT EXISTS follow_up_runtime_decision_severity text;
