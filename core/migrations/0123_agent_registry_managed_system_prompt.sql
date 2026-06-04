alter table agents
  add column if not exists managed_system_prompt text;
