create index if not exists agents_owner_created_id_idx
  on agents (owner_user_id, created_at, id);
