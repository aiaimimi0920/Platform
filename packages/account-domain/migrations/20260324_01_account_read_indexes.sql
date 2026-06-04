create index if not exists mailbox_messages_user_created_at_idx
  on mailbox_messages (user_id, created_at desc);

create index if not exists mailbox_messages_user_read_at_idx
  on mailbox_messages (user_id, read_at);

create index if not exists mailbox_attachments_message_claimed_at_idx
  on mailbox_attachments (message_id, claimed_at);

create index if not exists ledger_entries_user_created_at_idx
  on ledger_entries (user_id, created_at desc);

create index if not exists reputation_history_user_recorded_at_idx
  on reputation_history (user_id, recorded_at desc);

create index if not exists daily_reward_claims_user_claimed_at_idx
  on daily_reward_claims (user_id, claimed_at desc);
