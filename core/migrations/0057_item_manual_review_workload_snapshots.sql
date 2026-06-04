create table if not exists item_manual_review_workload_snapshots (
  id text primary key,
  source text not null,
  open_count integer not null,
  unclaimed_count integer not null,
  sla_breached_count integer not null,
  at_capacity_count integer not null,
  recommended_assignee_user_id text,
  claim_next_eta text,
  created_at timestamptz not null default now()
);

create index if not exists item_manual_review_workload_snapshots_created_idx
  on item_manual_review_workload_snapshots (created_at desc);
