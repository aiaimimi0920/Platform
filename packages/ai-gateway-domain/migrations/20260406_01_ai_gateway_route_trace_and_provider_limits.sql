alter table gateway_request_audits
  add column if not exists route_trace jsonb;
