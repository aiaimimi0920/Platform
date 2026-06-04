alter table if exists gateway_provider_accounts
  add column if not exists protocol_profile text;

update gateway_provider_accounts
set protocol_profile = case
  when coalesce(trim(protocol_profile), '') <> '' then trim(protocol_profile)
  when adapter = 'cohere_compatible' then 'cohere'
  when adapter = 'bedrock_converse_compatible' then 'aws_bedrock'
  when adapter = 'gemini_api_compatible' then 'google_gemini_api'
  when adapter = 'anthropic_compatible' then 'anthropic'
  when adapter = 'xfyun_websocket_compatible' then 'xfyun_native_websocket'
  when adapter in ('search_api_compatible', 'linkup_compatible') then 'search_generic'
  when lower(trim(label)) like 'openai%' then 'openai'
  when lower(trim(label)) like 'azure openai%' or lower(trim(label)) like 'azure-openai%' then 'azure_openai'
  when lower(trim(label)) like 'perplexity search%' then 'perplexity_search'
  when lower(trim(label)) like 'perplexity%' then 'perplexity_chat'
  else 'custom'
end
where coalesce(trim(protocol_profile), '') = '';

alter table if exists gateway_provider_accounts
  alter column protocol_profile set not null;

create index if not exists gateway_provider_accounts_protocol_profile_idx
  on gateway_provider_accounts (protocol_profile);
