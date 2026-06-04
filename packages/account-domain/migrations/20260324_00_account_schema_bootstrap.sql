create table if not exists feature_modules (
  module_key text primary key,
  enabled boolean not null,
  rollout_note text,
  updated_at timestamptz not null
);

create table if not exists users (
  id text primary key,
  username text not null,
  email text,
  avatar_url text,
  trust_level integer,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_login_at timestamptz not null
);

create table if not exists auth_identities (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  email text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists auth_identities_provider_identity_idx
  on auth_identities(provider, provider_user_id);

create table if not exists outbox_events (
  id text primary key,
  event_name text not null,
  consumer_service text not null default 'platform',
  payload jsonb not null,
  status text not null,
  attempts integer not null,
  max_attempts integer not null default 5,
  available_at timestamptz not null,
  processed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_error text
);

create index if not exists outbox_events_consumer_service_status_available_idx
  on outbox_events (consumer_service, status, available_at, created_at);

create table if not exists outbox_retry_attempts (
  id text primary key,
  event_id text not null references outbox_events(id) on delete cascade,
  event_name text not null,
  actor_user_id text not null references users(id) on delete cascade,
  previous_status text not null,
  previous_attempts integer not null,
  last_error text,
  retried_at timestamptz not null
);

create table if not exists ledger_accounts (
  id text primary key,
  user_id text not null,
  currency text not null,
  available_balance integer not null,
  frozen_balance integer not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists ledger_accounts_user_currency_idx
  on ledger_accounts(user_id, currency);

create table if not exists ledger_entries (
  id text primary key,
  user_id text not null,
  account_id text not null references ledger_accounts(id) on delete cascade,
  currency text not null,
  entry_type text not null,
  amount integer not null,
  balance_after_available integer not null,
  balance_after_frozen integer not null,
  note text,
  reference_type text,
  reference_id text,
  created_at timestamptz not null
);

create table if not exists products (
  id text primary key,
  slug text not null,
  title text not null,
  description text not null,
  category text not null,
  kind text not null,
  currency text not null,
  price integer not null,
  fulfillment_mode text not null,
  transferable boolean not null,
  active boolean not null,
  allow_discount_codes boolean not null,
  limit_scope text not null,
  duration_days integer,
  unit_count integer,
  warranty_days integer,
  stock_label text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists products_slug_idx
  on products(slug);

create table if not exists items (
  id text primary key,
  user_id text not null references users(id),
  product_id text not null references products(id),
  order_id text,
  product_title text not null,
  fulfillment_mode text not null,
  transferable boolean not null,
  status text not null,
  remaining_uses integer,
  total_units integer,
  active_units integer,
  replacement_count integer not null default 0,
  warranty_expires_at timestamptz,
  last_reconciled_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists item_units (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  slot_number integer not null,
  generation integer not null,
  code text not null,
  status text not null,
  issue_reason text,
  activated_at timestamptz,
  expires_at timestamptz,
  replaced_by_unit_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists item_units_item_code_idx
  on item_units(item_id, code);

create table if not exists mailbox_messages (
  id text primary key,
  user_id text not null references users(id),
  title text not null,
  body text not null,
  type text not null,
  read_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null
);

create table if not exists mailbox_attachments (
  id text primary key,
  message_id text not null references mailbox_messages(id) on delete cascade,
  kind text not null,
  currency text,
  amount integer,
  product_id text references products(id),
  item_id text references items(id),
  claimed_at timestamptz
);

create table if not exists daily_reward_claims (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  reward_date text not null,
  reward_currency text not null,
  reward_amount integer not null,
  streak_days_after_claim integer not null,
  claimed_at timestamptz not null
);

create unique index if not exists daily_reward_claims_user_date_idx
  on daily_reward_claims(user_id, reward_date);

create table if not exists daily_mission_claims (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  mission_key text not null,
  reward_date text not null,
  reward_currency text not null,
  reward_amount integer not null,
  claimed_at timestamptz not null
);

create unique index if not exists daily_mission_claims_user_mission_day_idx
  on daily_mission_claims(user_id, reward_date, mission_key);

create table if not exists weekly_mission_claims (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  mission_key text not null,
  week_key text not null,
  reward_currency text not null,
  reward_amount integer not null,
  claimed_at timestamptz not null
);

create unique index if not exists weekly_mission_claims_user_mission_week_idx
  on weekly_mission_claims(user_id, week_key, mission_key);

create table if not exists reputation_snapshots (
  user_id text primary key references users(id) on delete cascade,
  reputation_score integer not null,
  completed_task_count integer not null,
  defaulted_task_count integer not null,
  cancelled_task_count integer not null,
  active_task_count integer not null,
  favorable_arbitration_count integer not null default 0,
  unfavorable_arbitration_count integer not null default 0,
  trust_level integer not null default 0,
  base_score integer not null default 100,
  trust_bonus integer not null default 0,
  completed_contribution integer not null default 0,
  defaulted_penalty integer not null default 0,
  cancelled_penalty integer not null default 0,
  active_contribution integer not null default 0,
  arbitration_win_bonus integer not null default 0,
  arbitration_loss_penalty integer not null default 0,
  completion_rate real not null,
  default_rate real not null,
  tier text not null,
  updated_at timestamptz not null
);

create table if not exists reputation_history (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  reputation_score integer not null,
  completed_task_count integer not null,
  defaulted_task_count integer not null,
  cancelled_task_count integer not null,
  active_task_count integer not null,
  favorable_arbitration_count integer not null default 0,
  unfavorable_arbitration_count integer not null default 0,
  trust_level integer not null default 0,
  base_score integer not null default 100,
  trust_bonus integer not null default 0,
  completed_contribution integer not null default 0,
  defaulted_penalty integer not null default 0,
  cancelled_penalty integer not null default 0,
  active_contribution integer not null default 0,
  arbitration_win_bonus integer not null default 0,
  arbitration_loss_penalty integer not null default 0,
  completion_rate real not null,
  default_rate real not null,
  tier text not null,
  recorded_at timestamptz not null
);
