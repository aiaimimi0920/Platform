alter table products add column if not exists unit_count integer null;
alter table products add column if not exists warranty_days integer null;

alter table items add column if not exists total_units integer null;
alter table items add column if not exists active_units integer null;
alter table items add column if not exists replacement_count integer not null default 0;
alter table items add column if not exists warranty_expires_at timestamptz null;

create table if not exists item_units (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  slot_number integer not null,
  generation integer not null,
  code text not null,
  status text not null,
  issue_reason text null,
  activated_at timestamptz null,
  expires_at timestamptz null,
  replaced_by_unit_id text null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists item_units_item_code_idx
  on item_units(item_id, code);
