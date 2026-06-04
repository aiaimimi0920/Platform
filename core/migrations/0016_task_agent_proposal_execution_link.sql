alter table task_agent_proposals
  add column if not exists execution_id text null;
