-- Benefits base tables (moved from account-domain to resolve migration dependency)

create table if not exists benefit_families (
  key text primary key,
  title text not null,
  tone text not null,
  description text,
  sort_order integer not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists benefit_services (
  id text primary key,
  family_key text not null references benefit_families(key) on delete cascade,
  service_kind text not null,
  status text not null,
  title text not null,
  sort_order integer not null,
  config jsonb not null,
  created_by_user_id text references users(id) on delete set null,
  updated_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz
);

create index if not exists benefit_services_family_idx
  on benefit_services(family_key, sort_order);

create index if not exists benefit_services_status_idx
  on benefit_services(status);

create table if not exists benefit_product_bindings (
  id text primary key,
  service_id text not null references benefit_services(id) on delete cascade,
  product_id text not null references products(id) on delete cascade,
  created_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null
);

create unique index if not exists benefit_product_bindings_service_product_idx
  on benefit_product_bindings(service_id, product_id);

create table if not exists benefit_user_grants (
  id text primary key,
  service_id text not null references benefit_services(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  source_type text not null,
  source_key text not null,
  source_order_id text,
  source_item_id text,
  status text not null,
  granted_by_user_id text references users(id) on delete set null,
  granted_at timestamptz not null,
  updated_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by_user_id text references users(id) on delete set null
);

create unique index if not exists benefit_user_grants_source_key_idx
  on benefit_user_grants(service_id, user_id, source_key);

create index if not exists benefit_user_grants_status_idx
  on benefit_user_grants(service_id, user_id, status);

create table if not exists benefit_credential_pools (
  id text primary key,
  service_id text not null references benefit_services(id) on delete cascade,
  label text not null,
  import_note text,
  entry_count integer not null,
  created_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null
);

create table if not exists benefit_credential_entries (
  id text primary key,
  pool_id text not null references benefit_credential_pools(id) on delete cascade,
  service_id text not null references benefit_services(id) on delete cascade,
  entry_label text,
  refill_code text,
  api_key text,
  api_url text,
  status text not null,
  assigned_user_id text references users(id) on delete set null,
  assigned_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  -- Multi-credential failover fields
  priority integer not null default 0,
  failure_count integer not null default 0,
  last_failure_at timestamptz,
  last_success_at timestamptz,
  -- Credential-level proxy configuration
  proxy_config jsonb,
  -- Credential-level region configuration
  region_config jsonb
);

create index if not exists benefit_credential_entries_service_status_idx
  on benefit_credential_entries(service_id, status, created_at);

create table if not exists benefit_user_assignments (
  id text primary key,
  service_id text not null references benefit_services(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  credential_entry_id text references benefit_credential_entries(id) on delete set null,
  status text not null,
  assigned_at timestamptz,
  updated_at timestamptz not null,
  revoked_at timestamptz
);

create unique index if not exists benefit_user_assignments_service_user_idx
  on benefit_user_assignments(service_id, user_id);

create table if not exists benefit_service_api_access_keys (
  id text primary key,
  service_id text not null references benefit_services(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  status text not null,
  rotated_from_access_key_id text,
  revoked_at timestamptz,
  revoked_by_user_id text references users(id) on delete set null,
  revoke_reason text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists benefit_service_api_access_keys_active_service_user_idx
  on benefit_service_api_access_keys(service_id, user_id)
  where status = 'active';

create index if not exists benefit_service_api_access_keys_user_created_idx
  on benefit_service_api_access_keys(user_id, created_at desc);

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
