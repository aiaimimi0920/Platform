alter table task_dispatch_decisions
  alter column assigned_application_id drop not null;

alter table task_dispatch_decisions
  add column if not exists assigned_proposal_id text null references task_agent_proposals(id);
