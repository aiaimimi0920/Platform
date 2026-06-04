alter table agent_executions
  add column if not exists output_version integer,
  add column if not exists output_kind text,
  add column if not exists output_payload jsonb,
  add column if not exists output_generated_at timestamptz;
