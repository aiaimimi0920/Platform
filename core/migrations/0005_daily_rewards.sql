create table if not exists daily_reward_claims (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  reward_currency text not null,
  reward_amount integer not null,
  streak_days_after_claim integer not null,
  reward_date text not null,
  claimed_at timestamptz not null
);

create unique index if not exists daily_reward_claims_user_date_idx
  on daily_reward_claims(user_id, reward_date);

create index if not exists daily_reward_claims_user_claimed_at_idx
  on daily_reward_claims(user_id, claimed_at desc);
