-- Add multi-credential failover support fields to benefit_credential_entries

alter table benefit_credential_entries add column if not exists
  priority integer not null default 0;

alter table benefit_credential_entries add column if not exists
  failure_count integer not null default 0;

alter table benefit_credential_entries add column if not exists
  last_failure_at timestamptz;

alter table benefit_credential_entries add column if not exists
  last_success_at timestamptz;

alter table benefit_credential_entries add column if not exists
  proxy_config jsonb;

alter table benefit_credential_entries add column if not exists
  region_config jsonb;

-- Add indexes for performance
create index if not exists benefit_credential_entries_priority_idx
  on benefit_credential_entries(service_id, priority, status);

create index if not exists benefit_credential_entries_health_idx
  on benefit_credential_entries(service_id, failure_count, last_failure_at)
  where status = 'available';

comment on column benefit_credential_entries.priority is 'Lower number = higher priority for failover';
comment on column benefit_credential_entries.failure_count is 'Consecutive failure count for circuit breaker';
comment on column benefit_credential_entries.proxy_config is 'Credential-level proxy: {url, username, password} or "direct"';
comment on column benefit_credential_entries.region_config is 'Credential-level regions: {region, authRegion, apiRegion}';
