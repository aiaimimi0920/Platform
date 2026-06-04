alter table agent_capabilities
  add column if not exists routing_tags jsonb not null default '[]'::jsonb;
