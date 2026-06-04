alter table gateway_provider_accounts
  add column if not exists execution_mode text not null default 'direct_http';

alter table gateway_provider_accounts
  add column if not exists endpoint_execution_modes jsonb;

update gateway_provider_accounts
set execution_mode = 'browser_backed'
where adapter in ('lumalabs_compatible', 'gemini_canvas_compatible', 'udio_compatible')
  and execution_mode = 'direct_http';

update gateway_provider_accounts
set endpoint_execution_modes = coalesce(endpoint_execution_modes, '{}'::jsonb) || '{"videos_generations":"browser_backed"}'::jsonb
where adapter = 'producer_compatible';
