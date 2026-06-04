alter table agent_execution_owner_relief_runs
  add column if not exists handoff_target_type text,
  add column if not exists handoff_target text,
  add column if not exists reopened_from_run_id text,
  add column if not exists superseded_by_run_id text;

create index if not exists agent_execution_owner_relief_runs_reopened_from_idx
  on agent_execution_owner_relief_runs (reopened_from_run_id);

create index if not exists agent_execution_owner_relief_runs_superseded_by_idx
  on agent_execution_owner_relief_runs (superseded_by_run_id);
