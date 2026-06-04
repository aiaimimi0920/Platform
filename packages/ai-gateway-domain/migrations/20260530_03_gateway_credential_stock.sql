create table if not exists gateway_credential_stock_policies (
  id text primary key,
  stock_class_key text not null unique,
  display_name text not null,
  service_provider_key text not null,
  implementation_line_key text not null,
  provider_surface_key text not null,
  credential_material_kind text not null,
  provider_account_id text references gateway_provider_accounts(id) on delete set null,
  provider_adapter text,
  selector jsonb not null default '{}'::jsonb,
  metric_kind text not null default 'credential_count',
  token_window_key text,
  token_window_seconds bigint,
  min_credential_count integer,
  target_credential_count integer,
  max_credential_count integer,
  min_average_available_tokens bigint,
  target_average_available_tokens bigint,
  signal_enabled boolean not null default true,
  signal_stream text not null default 'gw:credential-stock:signals',
  signal_cooldown_secs bigint not null default 300,
  enabled boolean not null default true,
  last_signal_key text,
  last_signal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gateway_credential_stock_policies_metric_kind_chk
    check (metric_kind in ('credential_count', 'token_window')),
  constraint gateway_credential_stock_policies_count_nonnegative_chk
    check (
      (min_credential_count is null or min_credential_count >= 0)
      and (target_credential_count is null or target_credential_count >= 0)
      and (max_credential_count is null or max_credential_count >= 0)
    ),
  constraint gateway_credential_stock_policies_token_nonnegative_chk
    check (
      (min_average_available_tokens is null or min_average_available_tokens >= 0)
      and (target_average_available_tokens is null or target_average_available_tokens >= 0)
    )
);

create index if not exists idx_gateway_credential_stock_policies_enabled
  on gateway_credential_stock_policies(enabled, stock_class_key);

create index if not exists idx_gateway_credential_stock_policies_provider_line
  on gateway_credential_stock_policies(
    service_provider_key,
    implementation_line_key,
    provider_surface_key,
    credential_material_kind
  );

create index if not exists idx_gateway_credential_stock_policies_provider_account
  on gateway_credential_stock_policies(provider_account_id)
  where provider_account_id is not null;

create table if not exists gateway_credential_stock_signal_events (
  id text primary key,
  policy_id text not null references gateway_credential_stock_policies(id) on delete cascade,
  stock_class_key text not null,
  signal_key text not null,
  severity text not null,
  stream text not null,
  payload jsonb not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_gateway_credential_stock_signal_events_policy_created
  on gateway_credential_stock_signal_events(policy_id, created_at desc);

create index if not exists idx_gateway_credential_stock_signal_events_stock_created
  on gateway_credential_stock_signal_events(stock_class_key, created_at desc);

create index if not exists idx_gateway_credential_stock_signal_events_signal_key
  on gateway_credential_stock_signal_events(signal_key, created_at desc);
