alter table gateway_provider_accounts
  add column if not exists source_kind text,
  add column if not exists aggregator_api_mode text,
  add column if not exists web_reverse_access_mode text,
  add column if not exists source_notes text;

create index if not exists gateway_provider_accounts_source_status_idx
  on gateway_provider_accounts (source_kind, status);
