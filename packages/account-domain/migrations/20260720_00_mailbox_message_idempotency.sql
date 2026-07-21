alter table mailbox_messages
  add column if not exists idempotency_key text;

create unique index if not exists mailbox_messages_user_idempotency_idx
  on mailbox_messages(user_id, idempotency_key);
