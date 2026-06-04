alter table agents
  add column if not exists runtime_auth_token text;

alter table agent_executions
  add column if not exists marketplace_invocation jsonb;
