create table if not exists credential_providers (
  key text primary key,
  display_name text not null,
  description text,
  health_check_strategy text not null,
  default_assignment_mode text not null,
  payload_schema_version text not null,
  supports_repair boolean not null default true,
  supports_cooldown boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists credential_terminals (
  id text primary key,
  provider_key text not null references credential_providers(key) on delete cascade,
  label text not null,
  note text,
  status text not null,
  upload_token_hash text not null,
  last_seen_at timestamptz,
  last_upload_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists credential_upload_batches (
  id text primary key,
  provider_key text not null references credential_providers(key) on delete cascade,
  benefit_service_id text references benefit_services(id) on delete set null,
  terminal_id text references credential_terminals(id) on delete set null,
  token_kind text not null,
  label text not null,
  import_note text,
  accepted_count integer not null,
  rejected_count integer not null,
  inline_count integer not null,
  r2_count integer not null,
  created_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null
);

create table if not exists credential_entries (
  id text primary key,
  provider_key text not null references credential_providers(key) on delete cascade,
  benefit_service_id text not null references benefit_services(id) on delete cascade,
  upload_batch_id text references credential_upload_batches(id) on delete set null,
  source_terminal_id text references credential_terminals(id) on delete set null,
  entry_label text,
  storage_mode text not null,
  scope text not null,
  lifecycle_status text not null,
  private_user_id text references users(id) on delete set null,
  payload_schema_version text not null,
  masked_summary text not null,
  preview_label text,
  preview_url text,
  payload_inline jsonb,
  payload_object_key text,
  payload_content_type text,
  eligible_after timestamptz,
  invalid_reason text,
  death_reason text,
  failure_count integer not null default 0,
  last_health_check_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists credential_entries_service_lifecycle_idx
  on credential_entries(benefit_service_id, lifecycle_status, created_at);

create table if not exists credential_assignments (
  id text primary key,
  benefit_service_id text not null references benefit_services(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  credential_entry_id text references credential_entries(id) on delete set null,
  assignment_mode text not null,
  status text not null,
  assigned_at timestamptz,
  released_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null
);

create unique index if not exists credential_assignments_service_user_idx
  on credential_assignments(benefit_service_id, user_id);

create table if not exists credential_repair_claims (
  id text primary key,
  credential_entry_id text not null references credential_entries(id) on delete cascade,
  benefit_service_id text not null references benefit_services(id) on delete cascade,
  status text not null,
  claim_owner_type text not null,
  claim_owner_key text not null,
  claimed_at timestamptz not null,
  stale_at timestamptz not null,
  released_at timestamptz,
  resolved_at timestamptz
);

create unique index if not exists credential_repair_claims_entry_idx
  on credential_repair_claims(credential_entry_id);

create table if not exists credential_death_jobs (
  id text primary key,
  credential_entry_id text not null references credential_entries(id) on delete cascade,
  benefit_service_id text not null references benefit_services(id) on delete cascade,
  provider_key text not null references credential_providers(key) on delete cascade,
  object_key text,
  status text not null,
  attempts integer not null default 0,
  last_error text,
  requested_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create unique index if not exists credential_death_jobs_entry_idx
  on credential_death_jobs(credential_entry_id);

insert into credential_providers (
  key,
  display_name,
  description,
  health_check_strategy,
  default_assignment_mode,
  payload_schema_version,
  supports_repair,
  supports_cooldown,
  created_at,
  updated_at
)
values
  ('platform_a', 'A 平台', '多平台账号凭证池中的 A 平台 provider。', 'manual_review', 'sticky', 'credential-v1', true, true, timezone('utc', now()), timezone('utc', now())),
  ('platform_b', 'B 平台', '多平台账号凭证池中的 B 平台 provider。', 'manual_review', 'sticky', 'credential-v1', true, true, timezone('utc', now()), timezone('utc', now())),
  ('platform_c', 'C 平台', '多平台账号凭证池中的 C 平台 provider。', 'manual_review', 'sticky', 'credential-v1', true, true, timezone('utc', now()), timezone('utc', now()))
on conflict (key) do update
set
  display_name = excluded.display_name,
  description = excluded.description,
  health_check_strategy = excluded.health_check_strategy,
  default_assignment_mode = excluded.default_assignment_mode,
  payload_schema_version = excluded.payload_schema_version,
  supports_repair = excluded.supports_repair,
  supports_cooldown = excluded.supports_cooldown,
  updated_at = excluded.updated_at;

update benefit_services
set config =
  coalesce(config, '{}'::jsonb)
  || jsonb_build_object(
    'providerKey', coalesce(nullif(config ->> 'providerKey', ''), 'platform_a'),
    'assignmentMode', coalesce(nullif(config ->> 'assignmentMode', ''), 'sticky'),
    'payloadSchemaVersion', coalesce(nullif(config ->> 'payloadSchemaVersion', ''), 'credential-v1')
  )
where
  config is null
  or nullif(config ->> 'providerKey', '') is null
  or nullif(config ->> 'assignmentMode', '') is null
  or nullif(config ->> 'payloadSchemaVersion', '') is null;

insert into credential_upload_batches (
  id,
  provider_key,
  benefit_service_id,
  terminal_id,
  token_kind,
  label,
  import_note,
  accepted_count,
  rejected_count,
  inline_count,
  r2_count,
  created_by_user_id,
  created_at
)
select
  pools.id,
  coalesce(nullif(services.config ->> 'providerKey', ''), 'platform_a'),
  pools.service_id,
  null,
  'legacy_benefit_pool',
  pools.label,
  pools.import_note,
  pools.entry_count,
  0,
  pools.entry_count,
  0,
  pools.created_by_user_id,
  pools.created_at
from benefit_credential_pools as pools
inner join benefit_services as services
  on services.id = pools.service_id
on conflict (id) do nothing;

insert into credential_entries (
  id,
  provider_key,
  benefit_service_id,
  upload_batch_id,
  source_terminal_id,
  entry_label,
  storage_mode,
  scope,
  lifecycle_status,
  private_user_id,
  payload_schema_version,
  masked_summary,
  preview_label,
  preview_url,
  payload_inline,
  payload_object_key,
  payload_content_type,
  eligible_after,
  invalid_reason,
  death_reason,
  failure_count,
  last_health_check_at,
  created_at,
  updated_at,
  deleted_at
)
select
  entries.id,
  coalesce(nullif(services.config ->> 'providerKey', ''), 'platform_a'),
  entries.service_id,
  entries.pool_id,
  null,
  entries.entry_label,
  'inline',
  'public',
  case
    when entries.status = 'revoked' then 'invalid'
    else 'available'
  end,
  null,
  coalesce(nullif(services.config ->> 'payloadSchemaVersion', ''), 'credential-v1'),
  coalesce(
    nullif(entries.entry_label, ''),
    case
      when coalesce(nullif(entries.refill_code, ''), '') <> '' then concat(left(entries.refill_code, 4), '••••••', right(entries.refill_code, 4))
      when coalesce(nullif(entries.api_key, ''), '') <> '' then concat(left(entries.api_key, 4), '••••••', right(entries.api_key, 4))
      when coalesce(nullif(entries.api_url, ''), '') <> '' then entries.api_url
      else '已迁移凭证'
    end
  ),
  entries.entry_label,
  entries.api_url,
  jsonb_strip_nulls(
    jsonb_build_object(
      'entryLabel', entries.entry_label,
      'refillCode', entries.refill_code,
      'apiKey', entries.api_key,
      'apiUrl', entries.api_url
    )
  ),
  null,
  'application/json',
  null,
  case when entries.status = 'revoked' then 'migrated from legacy revoked entry' else null end,
  null,
  0,
  null,
  entries.created_at,
  entries.updated_at,
  null
from benefit_credential_entries as entries
inner join benefit_services as services
  on services.id = entries.service_id
on conflict (id) do nothing;

insert into credential_assignments (
  id,
  benefit_service_id,
  user_id,
  credential_entry_id,
  assignment_mode,
  status,
  assigned_at,
  released_at,
  revoked_at,
  updated_at
)
select
  assignments.id,
  assignments.service_id,
  assignments.user_id,
  assignments.credential_entry_id,
  coalesce(nullif(services.config ->> 'assignmentMode', ''), 'sticky'),
  case
    when assignments.status = 'active' then 'active'
    when assignments.status = 'revoked' then 'revoked'
    else 'released'
  end,
  assignments.assigned_at,
  case when assignments.status = 'pending' then assignments.updated_at else null end,
  assignments.revoked_at,
  assignments.updated_at
from benefit_user_assignments as assignments
inner join benefit_services as services
  on services.id = assignments.service_id
on conflict (benefit_service_id, user_id) do nothing;
