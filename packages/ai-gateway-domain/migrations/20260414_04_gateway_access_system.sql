create table if not exists gateway_provider_capability_catalog (
  id text primary key,
  provider_account_id text not null references gateway_provider_accounts(id) on delete cascade,
  model_code text not null,
  endpoint_kind text not null,
  upstream_model text,
  enabled boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists gateway_provider_capability_catalog_provider_model_endpoint_idx
  on gateway_provider_capability_catalog(provider_account_id, model_code, endpoint_kind);

create table if not exists gateway_platform_access_catalog (
  id text primary key,
  provider_capability_id text not null references gateway_provider_capability_catalog(id) on delete cascade,
  model_code text not null,
  endpoint_kind text not null,
  upstream_model text,
  platform_tier text not null,
  status text not null,
  operator_weight integer not null default 1,
  routing_priority integer not null default 100,
  enabled_for_sale boolean not null default true,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists gateway_platform_access_catalog_model_endpoint_idx
  on gateway_platform_access_catalog(model_code, endpoint_kind);

create index if not exists gateway_platform_access_catalog_status_sale_idx
  on gateway_platform_access_catalog(status, enabled_for_sale);

create table if not exists gateway_access_bundles (
  id text primary key,
  project_id text references gateway_projects(id) on delete set null,
  slug text not null,
  display_name text not null,
  status text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists gateway_access_bundles_slug_idx
  on gateway_access_bundles(slug);

create table if not exists gateway_access_bundle_items (
  bundle_id text not null references gateway_access_bundles(id) on delete cascade,
  platform_access_id text not null references gateway_platform_access_catalog(id) on delete cascade,
  created_at timestamptz not null,
  primary key (bundle_id, platform_access_id)
);

create table if not exists gateway_access_keys (
  id text primary key,
  owner_type text not null,
  owner_id text not null,
  resolved_project_id text not null references gateway_projects(id) on delete cascade,
  resolved_tenant_id text not null references gateway_tenants(id) on delete cascade,
  key_kind text not null,
  status text not null,
  public_key_prefix text not null,
  display_name text not null,
  external_key text,
  rotated_from_access_key_id text references gateway_access_keys(id) on delete set null,
  legacy_gateway_api_key_id text unique,
  legacy_user_credential_id text unique,
  expires_at timestamptz,
  last_used_at timestamptz,
  metadata jsonb,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists gateway_access_keys_external_key_idx
  on gateway_access_keys(external_key)
  where external_key is not null;

create index if not exists gateway_access_keys_owner_status_idx
  on gateway_access_keys(owner_type, owner_id, status);

create index if not exists gateway_access_keys_project_status_idx
  on gateway_access_keys(resolved_project_id, status);

create table if not exists gateway_access_key_bundle_bindings (
  access_key_id text not null references gateway_access_keys(id) on delete cascade,
  bundle_id text not null references gateway_access_bundles(id) on delete cascade,
  created_at timestamptz not null,
  primary key (access_key_id, bundle_id)
);

create table if not exists gateway_access_key_balances (
  access_key_id text primary key references gateway_access_keys(id) on delete cascade,
  balance_mode text not null,
  status text not null,
  unlimited_until timestamptz,
  period_starts_at timestamptz,
  period_ends_at timestamptz,
  total_tokens bigint,
  remaining_tokens bigint,
  total_messages bigint,
  remaining_messages bigint,
  updated_at timestamptz not null
);

create index if not exists gateway_access_key_balances_status_idx
  on gateway_access_key_balances(status, balance_mode);

create table if not exists gateway_access_key_aggregate_memberships (
  aggregate_access_key_id text not null references gateway_access_keys(id) on delete cascade,
  member_access_key_id text not null references gateway_access_keys(id) on delete cascade,
  priority integer not null default 100,
  created_at timestamptz not null,
  primary key (aggregate_access_key_id, member_access_key_id)
);

create index if not exists gateway_access_key_aggregate_memberships_member_idx
  on gateway_access_key_aggregate_memberships(member_access_key_id);

alter table gateway_request_audits
  add column if not exists access_key_id text references gateway_access_keys(id) on delete set null;

alter table gateway_request_audits
  add column if not exists source_access_key_id text references gateway_access_keys(id) on delete set null;

create index if not exists gateway_request_audits_access_key_created_idx
  on gateway_request_audits(access_key_id, created_at);

create index if not exists gateway_request_audits_source_access_key_created_idx
  on gateway_request_audits(source_access_key_id, created_at);

with seeded_capabilities as (
  select
    ('gpc-' || md5(ma.provider_account_id || ':' || ma.alias || ':' || coalesce(ma.upstream_model, ma.alias))) as id,
    ma.provider_account_id,
    ma.alias as model_code,
    'inference' as endpoint_kind,
    coalesce(ma.upstream_model, ma.alias) as upstream_model,
    now() as now_ts
  from gateway_model_aliases ma
  where ma.enabled = true
)
insert into gateway_provider_capability_catalog (
  id,
  provider_account_id,
  model_code,
  endpoint_kind,
  upstream_model,
  enabled,
  created_at,
  updated_at
)
select
  seeded_capabilities.id,
  seeded_capabilities.provider_account_id,
  seeded_capabilities.model_code,
  seeded_capabilities.endpoint_kind,
  seeded_capabilities.upstream_model,
  true,
  seeded_capabilities.now_ts,
  seeded_capabilities.now_ts
from seeded_capabilities
on conflict (id) do nothing;

with seeded_access as (
  select
    ('gpa-' || pc.id) as id,
    pc.id as provider_capability_id,
    pc.model_code,
    pc.endpoint_kind,
    pc.upstream_model,
    now() as now_ts
  from gateway_provider_capability_catalog pc
)
insert into gateway_platform_access_catalog (
  id,
  provider_capability_id,
  model_code,
  endpoint_kind,
  upstream_model,
  platform_tier,
  status,
  operator_weight,
  routing_priority,
  enabled_for_sale,
  notes,
  created_at,
  updated_at
)
select
  seeded_access.id,
  seeded_access.provider_capability_id,
  seeded_access.model_code,
  seeded_access.endpoint_kind,
  seeded_access.upstream_model,
  'mid',
  'active',
  1,
  100,
  true,
  'Seeded from legacy gateway_model_aliases during unified access-key migration.',
  seeded_access.now_ts,
  seeded_access.now_ts
from seeded_access
on conflict (id) do nothing;

insert into gateway_access_bundles (
  id,
  project_id,
  slug,
  display_name,
  status,
  description,
  metadata,
  created_at,
  updated_at
)
select
  ('bundle-project-' || p.id) as id,
  p.id,
  ('project-' || p.slug || '-default') as slug,
  (p.display_name || ' Default Access') as display_name,
  'active',
  'Legacy project bundle seeded during unified access-key migration.',
  jsonb_build_object('seededFrom', 'gateway_model_aliases'),
  now(),
  now()
from gateway_projects p
on conflict (id) do nothing;

insert into gateway_access_bundle_items (
  bundle_id,
  platform_access_id,
  created_at
)
select distinct
  ('bundle-project-' || ma.project_id) as bundle_id,
  ('gpa-' || 'gpc-' || md5(ma.provider_account_id || ':' || ma.alias || ':' || coalesce(ma.upstream_model, ma.alias))) as platform_access_id,
  now()
from gateway_model_aliases ma
where ma.enabled = true
on conflict do nothing;

insert into gateway_access_keys (
  id,
  owner_type,
  owner_id,
  resolved_project_id,
  resolved_tenant_id,
  key_kind,
  status,
  public_key_prefix,
  display_name,
  external_key,
  rotated_from_access_key_id,
  legacy_gateway_api_key_id,
  legacy_user_credential_id,
  expires_at,
  last_used_at,
  metadata,
  revoked_at,
  revoke_reason,
  created_at,
  updated_at
)
select
  ak.id,
  'project',
  ak.project_id,
  ak.project_id,
  p.tenant_id,
  'normal',
  case when ak.status = 'active' then 'active' else 'revoked' end,
  'new_api',
  ak.name,
  null,
  ak.rotated_from_api_key_id,
  ak.id,
  null,
  null,
  null,
  jsonb_build_object('seededFrom', 'gateway_api_keys'),
  ak.revoked_at,
  ak.revoke_reason,
  ak.created_at,
  ak.updated_at
from gateway_api_keys ak
join gateway_projects p on p.id = ak.project_id
on conflict (id) do nothing;

insert into gateway_access_keys (
  id,
  owner_type,
  owner_id,
  resolved_project_id,
  resolved_tenant_id,
  key_kind,
  status,
  public_key_prefix,
  display_name,
  external_key,
  rotated_from_access_key_id,
  legacy_gateway_api_key_id,
  legacy_user_credential_id,
  expires_at,
  last_used_at,
  metadata,
  revoked_at,
  revoke_reason,
  created_at,
  updated_at
)
select
  c.id,
  'user',
  c.user_id,
  c.project_id,
  p.tenant_id,
  'normal',
  case
    when c.status = 'active' and c.expires_at > now() then 'active'
    when c.status = 'revoked' then 'revoked'
    else 'expired'
  end,
  'gw-user',
  coalesce(c.credential_type, 'User access key'),
  c.credential_key,
  null,
  null,
  c.id,
  c.expires_at,
  c.last_used_at,
  jsonb_build_object('seededFrom', 'gateway_user_credentials', 'scope', c.scope, 'metadata', c.metadata),
  c.revoked_at,
  c.revoke_reason,
  c.created_at,
  c.updated_at
from gateway_user_credentials c
join gateway_projects p on p.id = c.project_id
on conflict (id) do nothing;

insert into gateway_access_key_bundle_bindings (
  access_key_id,
  bundle_id,
  created_at
)
select
  ak.id,
  ('bundle-project-' || ak.resolved_project_id) as bundle_id,
  now()
from gateway_access_keys ak
where ak.key_kind = 'normal'
on conflict do nothing;

insert into gateway_access_key_balances (
  access_key_id,
  balance_mode,
  status,
  unlimited_until,
  period_starts_at,
  period_ends_at,
  total_tokens,
  remaining_tokens,
  total_messages,
  remaining_messages,
  updated_at
)
select
  ak.id,
  'time_pass',
  case when ak.status = 'active' then 'active' else 'inactive' end,
  case
    when ak.public_key_prefix = 'gw-user' then ak.expires_at
    when ak.status = 'active' then '2099-01-01T00:00:00Z'::timestamptz
    else null
  end,
  now(),
  case
    when ak.public_key_prefix = 'gw-user' then ak.expires_at
    when ak.status = 'active' then '2099-01-01T00:00:00Z'::timestamptz
    else null
  end,
  null,
  null,
  null,
  null,
  now()
from gateway_access_keys ak
on conflict (access_key_id) do nothing;

update gateway_request_audits gra
set access_key_id = gra.api_key_id
where gra.access_key_id is null
  and gra.api_key_id is not null
  and exists (select 1 from gateway_access_keys ak where ak.id = gra.api_key_id);

update gateway_request_audits gra
set access_key_id = gra.user_credential_id
where gra.access_key_id is null
  and gra.user_credential_id is not null
  and exists (select 1 from gateway_access_keys ak where ak.id = gra.user_credential_id);
