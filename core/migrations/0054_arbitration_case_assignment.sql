alter table arbitration_cases
  add column if not exists assigned_operator_user_id text references users(id) on delete set null,
  add column if not exists claimed_at timestamptz;
