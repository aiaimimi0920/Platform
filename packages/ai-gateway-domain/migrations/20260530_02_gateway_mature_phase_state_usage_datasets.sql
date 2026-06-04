create index if not exists idx_gateway_provider_credential_model_states_provider_status
  on gateway_provider_credential_model_states(provider_account_id, status, cooldown_until);

create index if not exists idx_gateway_provider_credential_model_states_credential_model
  on gateway_provider_credential_model_states(provider_credential_id, protocol_profile, model);

create table if not exists gateway_usage_aggregates (
  bucket_start timestamptz not null,
  bucket_granularity text not null default '3600s',
  project_id text not null,
  user_id text not null,
  provider text not null,
  provider_credential_ref text not null,
  model text not null,
  request_count bigint not null default 0,
  failure_count bigint not null default 0,
  prompt_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  cache_creation_input_tokens bigint not null default 0,
  cache_read_input_tokens bigint not null default 0,
  latency_ms_sum bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (
    bucket_start,
    bucket_granularity,
    project_id,
    user_id,
    provider,
    provider_credential_ref,
    model
  )
);

create index if not exists idx_gateway_usage_aggregates_project_bucket
  on gateway_usage_aggregates(project_id, bucket_start desc);

create index if not exists idx_gateway_usage_aggregates_user_credential_model
  on gateway_usage_aggregates(user_id, provider_credential_ref, model, bucket_start desc);

create table if not exists gateway_conversation_dataset_exports (
  id text primary key,
  status text not null default 'review_pending',
  filter jsonb not null default '{}'::jsonb,
  sample_size integer,
  row_count integer not null default 0,
  dataset_object_key text not null,
  manifest_object_key text not null,
  created_by text,
  reviewer_id text,
  approval_note text,
  rejected_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gateway_conversation_dataset_exports_status
  on gateway_conversation_dataset_exports(status, created_at desc);
