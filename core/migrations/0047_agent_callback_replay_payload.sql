alter table agent_execution_callbacks
  add column if not exists replay_payload jsonb;
