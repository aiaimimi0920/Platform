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
