alter table agent_capabilities
  add column if not exists routing_summary text,
  add column if not exists resource_normalization_prompt text;

alter table agent_executions
  add column if not exists capability_id text references agent_capabilities(id) on delete set null,
  add column if not exists input_resource_payload jsonb,
  add column if not exists normalized_resource_payload jsonb,
  add column if not exists output_resource_payload jsonb;
