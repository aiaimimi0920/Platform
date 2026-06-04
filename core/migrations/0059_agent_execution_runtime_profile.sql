alter table agent_executions
  add column if not exists runtime_profile_key text not null default 'baseline',
  add column if not exists target_artifact_count integer not null default 1;
