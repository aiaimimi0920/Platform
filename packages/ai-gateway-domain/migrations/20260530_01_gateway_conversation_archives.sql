create table if not exists gateway_conversation_archives (
  id text primary key,
  request_audit_id text references gateway_request_audits(id) on delete set null,
  request_id text not null,
  project_id text,
  user_id text,
  session_id text,
  provider_account_id text,
  provider_credential_ref text,
  protocol_family text not null,
  protocol_profile text,
  endpoint_kind text not null,
  requested_model text,
  resolved_model text,
  status text not null default 'completed',
  upstream_status integer,
  failure_class text,
  failure_scope text,
  request_object_key text,
  response_object_key text,
  redaction_version text not null default 'v1',
  truncated_request boolean not null default false,
  truncated_response boolean not null default false,
  archive_error text,
  retention_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gateway_conversation_archives_project_created
  on gateway_conversation_archives(project_id, created_at desc);

create index if not exists idx_gateway_conversation_archives_user_created
  on gateway_conversation_archives(user_id, created_at desc);

create index if not exists idx_gateway_conversation_archives_provider_created
  on gateway_conversation_archives(provider_account_id, created_at desc);

create index if not exists idx_gateway_conversation_archives_status_created
  on gateway_conversation_archives(status, created_at desc);

create index if not exists idx_gateway_conversation_archives_retention
  on gateway_conversation_archives(retention_expires_at);

create table if not exists gateway_provider_credential_model_states (
  id text primary key,
  provider_account_id text not null references gateway_provider_accounts(id) on delete cascade,
  provider_credential_id text references gateway_provider_credentials(id) on delete cascade,
  provider_credential_ref text,
  protocol_profile text,
  model text not null,
  status text not null default 'active',
  failure_class text,
  failure_scope text,
  failure_count integer not null default 0,
  last_error text,
  last_upstream_status integer,
  cooldown_until timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_account_id, provider_credential_id, provider_credential_ref, protocol_profile, model)
);

create index if not exists idx_gateway_provider_credential_model_states_provider_status
  on gateway_provider_credential_model_states(provider_account_id, status);

create index if not exists idx_gateway_provider_credential_model_states_credential_status
  on gateway_provider_credential_model_states(provider_credential_id, status);

create index if not exists idx_gateway_provider_credential_model_states_cooldown
  on gateway_provider_credential_model_states(status, cooldown_until);
