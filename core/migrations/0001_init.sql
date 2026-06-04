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
  payload jsonb not null,
  status text not null,
  attempts integer not null,
  available_at timestamptz not null,
  processed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
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
  kind text not null,
  currency text not null,
  price integer not null,
  fulfillment_mode text not null,
  transferable boolean not null,
  active boolean not null,
  limit_scope text not null,
  duration_days integer,
  stock_label text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists products_slug_idx
  on products(slug);

create table if not exists orders (
  id text primary key,
  user_id text not null,
  product_id text not null references products(id),
  currency text not null,
  amount integer not null,
  status text not null,
  created_at timestamptz not null
);

create table if not exists items (
  id text primary key,
  user_id text not null,
  product_id text not null references products(id),
  order_id text references orders(id),
  product_title text not null,
  fulfillment_mode text not null,
  transferable boolean not null,
  status text not null,
  remaining_uses integer,
  expires_at timestamptz,
  created_at timestamptz not null
);

create table if not exists tasks (
  id text primary key,
  creator_user_id text not null references users(id),
  assigned_user_id text references users(id),
  title text not null,
  description text not null,
  reward_currency text not null,
  reward_amount integer not null,
  required_bond_amount integer not null,
  status text not null,
  created_at timestamptz not null
);

create table if not exists task_applications (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  applicant_user_id text not null references users(id),
  statement text not null,
  proposed_eta_hours integer not null,
  status text not null,
  created_at timestamptz not null
);

create table if not exists bond_holds (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  application_id text not null references task_applications(id) on delete cascade,
  user_id text not null references users(id),
  currency text not null,
  amount integer not null,
  status text not null,
  created_at timestamptz not null,
  released_at timestamptz
);

create table if not exists task_dispatch_decisions (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  assigned_application_id text not null references task_applications(id),
  assigned_user_id text not null references users(id),
  decided_at timestamptz not null
);

create unique index if not exists task_dispatch_decisions_task_idx
  on task_dispatch_decisions(task_id);

create table if not exists redemption_codes (
  id text primary key,
  code text not null,
  active boolean not null,
  reward_kind text not null,
  currency text,
  amount integer,
  product_id text references products(id),
  max_uses integer not null,
  used_count integer not null,
  expires_at timestamptz,
  created_at timestamptz not null
);

create unique index if not exists redemption_codes_code_idx
  on redemption_codes(code);

create table if not exists redemption_code_usages (
  id text primary key,
  redemption_code_id text not null references redemption_codes(id) on delete cascade,
  user_id text not null references users(id),
  created_at timestamptz not null
);

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

create table if not exists marketplace_listings (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  seller_user_id text not null references users(id),
  product_title text not null,
  currency text not null,
  price integer not null,
  status text not null,
  created_at timestamptz not null
);
