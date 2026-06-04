alter table if exists gateway_provider_accounts
  add column if not exists service_provider_key text,
  add column if not exists service_provider_label text;

with normalized as (
  select
    id,
    label,
    case
      when lower(trim(label)) like 'xfyun platform%' then 'xfyun platform'
      else trim(label)
    end as normalized_label
  from gateway_provider_accounts
)
update gateway_provider_accounts as accounts
set
  service_provider_label = normalized.normalized_label,
  service_provider_key = case
    when lower(trim(normalized.normalized_label)) = 'xfyun platform' then 'xfyun_platform'
    when trim(both '_' from regexp_replace(lower(normalized.normalized_label), '[^a-z0-9]+', '_', 'g')) <> '' then
      trim(both '_' from regexp_replace(lower(normalized.normalized_label), '[^a-z0-9]+', '_', 'g'))
    else
      'sp_' || substr(md5(normalized.normalized_label), 1, 16)
  end
from normalized
where accounts.id = normalized.id
  and (
    coalesce(trim(accounts.service_provider_key), '') = ''
    or coalesce(trim(accounts.service_provider_label), '') = ''
  );

alter table if exists gateway_provider_accounts
  alter column service_provider_key set not null,
  alter column service_provider_label set not null;

create index if not exists gateway_provider_accounts_service_provider_key_idx
  on gateway_provider_accounts (service_provider_key);
