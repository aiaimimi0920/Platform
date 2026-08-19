with ranked_active_platform_runs as (
  select
    id,
    row_number() over (
      partition by execution_id
      order by created_at desc, id desc
    ) as active_rank
  from agent_execution_runs
  where status = 'running'
    and run_kind = 'platform_executor'
)
update agent_execution_runs as runs
set
  status = 'failed',
  summary = coalesce(runs.summary, 'Superseded duplicate platform executor run.'),
  error_message = coalesce(runs.error_message, 'Migration closed a duplicate active platform executor run.'),
  finished_at = coalesce(runs.finished_at, now())
from ranked_active_platform_runs as ranked
where runs.id = ranked.id
  and ranked.active_rank > 1;

create unique index if not exists agent_execution_runs_one_active_platform_idx
  on agent_execution_runs (execution_id)
  where status = 'running'
    and run_kind = 'platform_executor';

alter table agent_execution_callbacks
  add column if not exists payload_hash text;

with ranked_accepted_callbacks as (
  select
    id,
    row_number() over (
      partition by execution_id, callback_id
      order by received_at asc, id asc
    ) as accepted_rank
  from agent_execution_callbacks
  where status = 'accepted'
)
update agent_execution_callbacks as callbacks
set status = 'duplicate'
from ranked_accepted_callbacks as ranked
where callbacks.id = ranked.id
  and ranked.accepted_rank > 1;

create unique index if not exists agent_execution_callbacks_accepted_idempotency_idx
  on agent_execution_callbacks (execution_id, callback_id)
  where status = 'accepted';
