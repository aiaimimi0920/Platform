create index if not exists gateway_request_audits_provider_inventory_idx
  on gateway_request_audits (provider_account_id, created_at desc)
  include (
    status,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    cache_creation_input_tokens,
    cache_read_input_tokens,
    requested_model,
    resolved_model,
    model_alias
  )
  where provider_account_id is not null;
