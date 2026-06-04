alter table arbitration_case_review_rounds
  add column if not exists final_escalated_at timestamptz,
  add column if not exists final_escalation_count integer not null default 0;
