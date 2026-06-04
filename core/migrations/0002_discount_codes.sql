create table if not exists discount_codes (
  id text primary key,
  code text not null,
  enabled boolean not null,
  scope text not null,
  target_product_category text,
  target_product_id text references products(id),
  audience_scope text not null,
  audience_group_key text,
  audience_user_id text,
  value_kind text not null,
  value_amount integer not null,
  total_max_uses integer,
  used_count integer not null,
  per_user_limit integer,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists discount_codes_code_idx
  on discount_codes(code);

alter table products
  add column if not exists category text not null default 'general';

alter table products
  add column if not exists allow_discount_codes boolean not null default false;

update products
set category = 'membership',
    allow_discount_codes = true
where id = 'product_vip_30' and category = 'general';

update products
set category = 'account',
    allow_discount_codes = true
where id = 'product_account_bundle' and category = 'general';

update products
set category = 'qualification',
    allow_discount_codes = false
where id = 'product_mira_pass' and category = 'general';

alter table orders
  add column if not exists original_amount integer not null default 0;

alter table orders
  add column if not exists discount_amount integer not null default 0;

alter table orders
  add column if not exists final_amount integer not null default 0;

alter table orders
  add column if not exists discount_code_id text references discount_codes(id);

alter table orders
  add column if not exists discount_code text;

update orders
set original_amount = amount,
    discount_amount = 0,
    final_amount = amount
where original_amount = 0 and final_amount = 0;

create table if not exists discount_code_usages (
  id text primary key,
  discount_code_id text not null references discount_codes(id) on delete cascade,
  user_id text not null references users(id),
  order_id text references orders(id) on delete set null,
  created_at timestamptz not null
);
