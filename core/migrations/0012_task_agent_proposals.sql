create table if not exists task_agent_proposals (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  proposer_user_id text not null references users(id) on delete cascade,
  agent_id text not null references agents(id) on delete cascade,
  statement text not null,
  proposed_eta_hours integer not null,
  proposed_cost_note text,
  status text not null,
  created_at timestamptz not null
);

create unique index if not exists task_agent_proposals_task_agent_idx
  on task_agent_proposals(task_id, agent_id);
