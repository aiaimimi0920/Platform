create table if not exists gateway_tenants (
  id text primary key,
  slug text not null,
  display_name text not null,
  status text not null,
  owner_user_id text,
  source_kind text not null,
  source_key text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists gateway_tenants_source_key_idx
  on gateway_tenants (source_kind, source_key);

create table if not exists gateway_projects (
  id text primary key,
  tenant_id text not null references gateway_tenants(id) on delete cascade,
  slug text not null,
  display_name text not null,
  status text not null,
  source_kind text not null,
  source_key text not null,
  default_route_policy_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists gateway_projects_source_key_idx
  on gateway_projects (source_kind, source_key);

create table if not exists gateway_api_keys (
  id text primary key,
  project_id text not null references gateway_projects(id) on delete cascade,
  name text not null,
  status text not null,
  rotated_from_api_key_id text,
  revoked_at timestamptz,
  revoked_by_user_id text,
  revoke_reason text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists gateway_provider_accounts (
  id text primary key,
  label text not null,
  adapter text not null,
  protocol_family text not null,
  status text not null,
  payload_inline jsonb,
  payload_object_key text,
  payload_content_type text,
  storage_mode text not null,
  cooldown_until timestamptz,
  last_error text,
  failure_count integer not null default 0,
  last_health_check_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz
);

create table if not exists gateway_model_aliases (
  id text primary key,
  project_id text references gateway_projects(id) on delete cascade,
  scope_type text not null default 'global',
  alias text not null,
  provider_account_id text not null references gateway_provider_accounts(id) on delete cascade,
  upstream_model text,
  priority integer not null default 100,
  weight integer not null default 1,
  enabled boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists gateway_route_policies (
  id text primary key,
  project_id text not null references gateway_projects(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  enabled boolean not null default true,
  config jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists gateway_sessions (
  id text primary key,
  project_id text not null references gateway_projects(id) on delete cascade,
  session_key text not null,
  protocol_family text not null,
  provider_account_id text not null references gateway_provider_accounts(id) on delete cascade,
  latest_response_id text,
  upstream_session_id text,
  runtime_state_object_key text,
  active_request_audit_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_used_at timestamptz not null,
  revoked_at timestamptz
);

create unique index if not exists gateway_sessions_project_session_idx
  on gateway_sessions (project_id, session_key);

create table if not exists gateway_request_audits (
  id text primary key,
  project_id text not null references gateway_projects(id) on delete cascade,
  api_key_id text not null references gateway_api_keys(id) on delete cascade,
  session_id text references gateway_sessions(id) on delete set null,
  route_policy_id text,
  provider_account_id text references gateway_provider_accounts(id) on delete set null,
  protocol_family text not null,
  endpoint_kind text not null,
  requested_model text,
  resolved_model text,
  model_alias text,
  stream boolean not null default false,
  route_attempt_count integer not null default 1,
  status text not null,
  upstream_status integer,
  duration_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  error_summary text,
  response_id text not null,
  previous_response_id text,
  client_disconnected_at timestamptz,
  created_at timestamptz not null,
  completed_at timestamptz,
  updated_at timestamptz not null
);

create unique index if not exists gateway_request_audits_response_id_idx
  on gateway_request_audits (response_id);
