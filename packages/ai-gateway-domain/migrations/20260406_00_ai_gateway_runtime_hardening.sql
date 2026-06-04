create index if not exists gateway_api_keys_project_status_idx
  on gateway_api_keys (project_id, status);

create index if not exists gateway_provider_accounts_status_cooldown_idx
  on gateway_provider_accounts (status, cooldown_until);

create index if not exists gateway_provider_accounts_protocol_status_idx
  on gateway_provider_accounts (protocol_family, status);

create index if not exists gateway_model_aliases_project_alias_enabled_idx
  on gateway_model_aliases (project_id, alias, enabled);

create index if not exists gateway_model_aliases_alias_enabled_idx
  on gateway_model_aliases (alias, enabled);

create index if not exists gateway_route_policies_project_default_enabled_idx
  on gateway_route_policies (project_id, is_default, enabled);

create index if not exists gateway_sessions_project_last_used_idx
  on gateway_sessions (project_id, last_used_at desc);

create index if not exists gateway_request_audits_project_created_idx
  on gateway_request_audits (project_id, created_at desc);

create index if not exists gateway_request_audits_provider_created_idx
  on gateway_request_audits (provider_account_id, created_at desc);
