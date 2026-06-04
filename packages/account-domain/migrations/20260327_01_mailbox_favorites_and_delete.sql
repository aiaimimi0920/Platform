alter table mailbox_messages
  add column if not exists favorited_at timestamp with time zone;

create index if not exists mailbox_messages_user_folder_favorited_created_idx
  on mailbox_messages(user_id, folder, favorited_at desc, created_at desc);

create index if not exists mailbox_messages_user_inbox_prune_idx
  on mailbox_messages(user_id, folder, created_at asc, id)
  where favorited_at is null;
