alter table agent_executions
  add column if not exists objective_checklist jsonb not null default '[]'::jsonb;

update agent_executions
set objective_checklist = coalesce(objective_checklist, '[]'::jsonb)
where objective_checklist is null;
