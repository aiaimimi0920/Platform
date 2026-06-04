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
  on daily_mission_claims(user_id, mission_key, reward_date);
