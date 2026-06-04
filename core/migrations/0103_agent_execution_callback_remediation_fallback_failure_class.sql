alter table agent_execution_callback_remediations
  add column if not exists fallback_failure_class text;

update agent_execution_callback_remediations
set fallback_failure_class =
  case
    when fallback_reason like 'stored_payload_unavailable:%' then 'stored_payload_unavailable'
    when fallback_reason like 'callback_secret_unavailable:%' then 'callback_secret_unavailable'
    when fallback_reason like 'duplicate_replay_cooldown:%' then 'duplicate_replay_cooldown'
    else fallback_failure_class
  end
where fallback_failure_class is null;
