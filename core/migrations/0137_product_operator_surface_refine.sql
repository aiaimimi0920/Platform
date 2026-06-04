alter table products
  add column if not exists targeted_audience_group_key text;

create table if not exists product_seed_tombstones (
  product_id text primary key,
  deleted_at timestamptz not null
);
