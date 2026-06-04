ALTER TABLE agent_execution_launch_presets
  ADD COLUMN IF NOT EXISTS follow_up_replay_payload_compatibility text,
  ADD COLUMN IF NOT EXISTS follow_up_replay_payload_replayable boolean;
