ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS managed_task_category text;

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS managed_capability_summary text;
