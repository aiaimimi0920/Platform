create table if not exists item_fulfillment_runs (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  trigger text not null,
  status text not null,
  scanned_units integer not null,
  replacements_created integer not null,
  note text,
  created_at timestamptz not null
);

create index if not exists item_fulfillment_runs_item_idx
  on item_fulfillment_runs (item_id, created_at);
