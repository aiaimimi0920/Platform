alter table orders
  add column if not exists rolled_back_at timestamptz,
  add column if not exists rolled_back_by_user_id text,
  add column if not exists rollback_reason text,
  add column if not exists rollback_note text;

alter table items
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by_user_id text,
  add column if not exists revocation_reason text;
