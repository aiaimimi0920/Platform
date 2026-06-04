alter table products
  add column if not exists gateway_access_grant_mode text,
  add column if not exists gateway_access_grant_quantity integer;
