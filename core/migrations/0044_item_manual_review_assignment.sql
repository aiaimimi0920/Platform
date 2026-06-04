alter table item_manual_reviews
  add column if not exists assignee_user_id text,
  add column if not exists claimed_at timestamptz;
