alter table if exists gateway_access_bundles
  add column if not exists billing_mode text;

update gateway_access_bundles
set billing_mode = coalesce(nullif(metadata ->> 'billingMode', ''), 'time_pass')
where billing_mode is null or btrim(billing_mode) = '';

alter table if exists gateway_access_bundles
  alter column billing_mode set default 'time_pass';

alter table if exists gateway_access_bundles
  alter column billing_mode set not null;
