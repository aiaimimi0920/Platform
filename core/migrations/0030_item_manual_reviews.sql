create table if not exists item_manual_reviews (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  unit_id text not null references item_units(id) on delete cascade,
  report_id text not null references item_issue_reports(id) on delete cascade,
  slot_number integer not null,
  status text not null,
  reason text not null,
  resolution_action text,
  resolution_note text,
  reviewer_user_id text,
  created_at timestamptz not null,
  resolved_at timestamptz
);

create unique index if not exists item_manual_reviews_report_idx
  on item_manual_reviews (report_id);

create index if not exists item_manual_reviews_status_idx
  on item_manual_reviews (status, created_at desc);
