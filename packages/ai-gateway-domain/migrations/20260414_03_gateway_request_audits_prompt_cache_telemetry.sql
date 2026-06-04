alter table gateway_request_audits
  add column if not exists client_has_cache_control boolean not null default false;

alter table gateway_request_audits
  add column if not exists auto_cache_applied boolean not null default false;
