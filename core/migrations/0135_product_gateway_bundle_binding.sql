alter table products
  add column if not exists gateway_access_bundle_id text;

create table if not exists product_gateway_access_grants (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  order_id text references orders(id) on delete set null,
  user_id text not null,
  product_id text not null references products(id),
  bundle_id text not null,
  grant_mode text not null,
  duration_days integer,
  token_amount integer,
  message_amount integer,
  granted_at timestamptz not null,
  effective_starts_at timestamptz not null,
  effective_ends_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists product_gateway_access_grants_item_idx
  on product_gateway_access_grants(item_id);

create index if not exists product_gateway_access_grants_order_idx
  on product_gateway_access_grants(order_id);

create index if not exists product_gateway_access_grants_user_bundle_idx
  on product_gateway_access_grants(user_id, bundle_id);

create index if not exists product_gateway_access_grants_user_bundle_revoked_idx
  on product_gateway_access_grants(user_id, bundle_id, revoked_at, granted_at);
