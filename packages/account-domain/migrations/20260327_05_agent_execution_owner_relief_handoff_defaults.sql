create table if not exists agent_execution_owner_relief_handoff_defaults (
  operator_user_id text not null references users(id),
  handoff_target_type text not null,
  handoff_target text not null,
  note_template text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (operator_user_id, handoff_target_type)
);

create index if not exists agent_execution_owner_relief_handoff_defaults_owner_updated_idx
  on agent_execution_owner_relief_handoff_defaults (operator_user_id, updated_at desc);
