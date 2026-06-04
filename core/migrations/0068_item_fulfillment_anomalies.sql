create table if not exists item_fulfillment_anomalies (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  report_id text references item_issue_reports(id) on delete set null,
  review_id text references item_manual_reviews(id) on delete set null,
  kind text not null,
  severity text not null,
  status text not null,
  routing_code text,
  summary text not null,
  detail text,
  detected_at timestamptz not null,
  last_seen_at timestamptz not null,
  occurrence_count integer not null default 1,
  resolved_at timestamptz,
  resolution_note text
);

create index if not exists item_fulfillment_anomalies_item_idx
  on item_fulfillment_anomalies(item_id, detected_at desc);

create index if not exists item_fulfillment_anomalies_status_idx
  on item_fulfillment_anomalies(status, severity, detected_at desc);
