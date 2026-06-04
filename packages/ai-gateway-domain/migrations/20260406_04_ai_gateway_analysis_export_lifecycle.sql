alter table gateway_analysis_exports
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'active',
  add column if not exists retention_expires_at timestamptz,
  add column if not exists cleaned_up_at timestamptz,
  add column if not exists last_cleanup_error text;

create index if not exists gateway_analysis_exports_status_retention_idx
  on gateway_analysis_exports (status, retention_expires_at);
