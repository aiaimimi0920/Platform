alter table "agent_executions"
  add column if not exists "callback_remediation_policy_key" text;

alter table "agent_execution_callbacks"
  add column if not exists "remediation_policy_key" text;

update "agent_execution_callbacks" as callback_audit
set "remediation_policy_key" = coalesce(
  execution."callback_remediation_policy_key",
  agent."external_callback_remediation_policy",
  'balanced'
)
from "agent_executions" as execution
left join "agents" as agent on agent."id" = execution."agent_id"
where callback_audit."execution_id" = execution."id"
  and (
    callback_audit."remediation_policy_key" is null
    or callback_audit."remediation_policy_key" = ''
  );

update "agent_execution_callbacks"
set "remediation_policy_key" = 'balanced'
where "remediation_policy_key" is null
  or "remediation_policy_key" = '';

alter table "agent_execution_callbacks"
  alter column "remediation_policy_key" set default 'balanced';

alter table "agent_execution_callbacks"
  alter column "remediation_policy_key" set not null;
