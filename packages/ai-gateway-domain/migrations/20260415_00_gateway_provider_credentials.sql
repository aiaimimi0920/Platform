create table if not exists gateway_provider_credentials (
  id text primary key,
  provider_account_id text not null references gateway_provider_accounts(id) on delete cascade,
  label text not null,
  status text not null,
  payload_inline jsonb,
  payload_object_key text,
  payload_content_type text,
  storage_mode text not null,
  source_kind text not null default 'manual',
  source_path text,
  source_hash text,
  sync_mode text not null default 'manual',
  sync_state text not null default 'idle',
  sync_error text,
  cooldown_until timestamptz,
  last_error text,
  failure_count integer not null default 0,
  last_health_check_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz
);

create index if not exists gateway_provider_credentials_provider_status_idx
  on gateway_provider_credentials (provider_account_id, status);

create index if not exists gateway_provider_credentials_status_cooldown_idx
  on gateway_provider_credentials (status, cooldown_until);

create unique index if not exists gateway_provider_credentials_source_path_idx
  on gateway_provider_credentials (source_path)
  where source_path is not null;

insert into gateway_provider_credentials (
  id,
  provider_account_id,
  label,
  status,
  payload_inline,
  payload_object_key,
  payload_content_type,
  storage_mode,
  source_kind,
  sync_mode,
  sync_state,
  cooldown_until,
  last_error,
  failure_count,
  last_health_check_at,
  created_at,
  updated_at,
  archived_at
)
select
  concat(pa.id, ':legacy'),
  pa.id,
  concat(pa.label, ' Default Credential'),
  case when pa.archived_at is not null then 'archived' else coalesce(pa.status, 'active') end,
  pa.payload_inline,
  pa.payload_object_key,
  pa.payload_content_type,
  coalesce(pa.storage_mode, 'inline'),
  'legacy_payload_import',
  'manual',
  'idle',
  pa.cooldown_until,
  pa.last_error,
  coalesce(pa.failure_count, 0),
  pa.last_health_check_at,
  coalesce(pa.created_at, now()),
  coalesce(pa.updated_at, now()),
  pa.archived_at
from gateway_provider_accounts pa
where (pa.payload_inline is not null or pa.payload_object_key is not null)
  and not exists (
    select 1
    from gateway_provider_credentials pc
    where pc.provider_account_id = pa.id
  );
