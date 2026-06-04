create table if not exists benefit_service_proxy_bindings (
  id text primary key,
  service_id text not null references benefit_services(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  credential_entry_id text,
  status text not null,
  assigned_at timestamptz not null,
  updated_at timestamptz not null,
  revoked_at timestamptz
);

create unique index if not exists benefit_service_proxy_bindings_service_user_idx
  on benefit_service_proxy_bindings(service_id, user_id);

create table if not exists benefit_service_proxy_requests (
  id text primary key,
  access_key_id text not null references benefit_service_api_access_keys(id) on delete cascade,
  service_id text not null references benefit_services(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  binding_id text references benefit_service_proxy_bindings(id) on delete set null,
  credential_entry_id text,
  endpoint_kind text not null,
  model text,
  session_key text,
  response_id text not null,
  previous_response_id text,
  stream boolean not null default false,
  relay_status text not null,
  upstream_status integer,
  duration_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  error_summary text,
  completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists benefit_service_proxy_requests_response_id_idx
  on benefit_service_proxy_requests(response_id);

create index if not exists benefit_service_proxy_requests_service_created_idx
  on benefit_service_proxy_requests(service_id, created_at desc, id desc);
