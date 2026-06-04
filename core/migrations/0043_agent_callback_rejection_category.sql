alter table agent_execution_callbacks
  add column if not exists rejection_category text;
