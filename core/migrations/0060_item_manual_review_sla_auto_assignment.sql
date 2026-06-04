alter table item_manual_reviews
  add column if not exists auto_assignment_count integer not null default 0,
  add column if not exists last_auto_assigned_at timestamptz,
  add column if not exists escalation_level integer not null default 0,
  add column if not exists sla_escalated_at timestamptz;

alter table item_manual_review_workload_snapshots
  add column if not exists breached_unclaimed_count integer not null default 0;
