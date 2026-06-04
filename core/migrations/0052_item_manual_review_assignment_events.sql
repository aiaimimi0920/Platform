create table if not exists item_manual_review_assignment_events (
  id text primary key,
  review_id text not null references item_manual_reviews(id) on delete cascade,
  item_id text not null references items(id) on delete cascade,
  report_id text not null references item_issue_reports(id) on delete cascade,
  actor_user_id text not null,
  action text not null,
  from_assignee_user_id text,
  to_assignee_user_id text,
  note text,
  created_at timestamptz not null
);

create index if not exists item_manual_review_assignment_events_review_idx
  on item_manual_review_assignment_events(review_id, created_at desc);

create index if not exists item_manual_review_assignment_events_item_idx
  on item_manual_review_assignment_events(item_id, created_at desc);
