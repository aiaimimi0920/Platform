alter table items add column if not exists last_reconciled_at timestamptz null;

create table if not exists item_issue_reports (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  unit_id text not null references item_units(id) on delete cascade,
  reporter_user_id text not null,
  reason text not null,
  outcome text not null,
  rejection_code text null,
  replacement_unit_id text null references item_units(id) on delete set null,
  created_at timestamptz not null
);

create table if not exists item_replacement_logs (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  previous_unit_id text null references item_units(id) on delete set null,
  replacement_unit_id text not null references item_units(id) on delete cascade,
  reason text null,
  trigger text not null,
  created_at timestamptz not null
);
