alter table personal_mission_claims
  add column if not exists base_reward_amount integer,
  add column if not exists bonus_reward_amount integer,
  add column if not exists bonus_source_wager_amount integer,
  add column if not exists bonus_multiplier integer;

create table if not exists personal_mission_checkin_wagers (
  id text primary key,
  mission_id text not null references personal_mission_definitions(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  source_day_key text not null,
  reward_period_key text not null,
  reward_currency text not null,
  wager_amount integer not null,
  bonus_amount integer not null,
  bonus_multiplier integer not null,
  consumed_by_claim_id text references personal_mission_claims(id) on delete set null,
  placed_at timestamptz not null,
  consumed_at timestamptz
);

create unique index if not exists personal_mission_checkin_wagers_user_mission_source_day_idx
  on personal_mission_checkin_wagers(user_id, mission_id, source_day_key);

create unique index if not exists personal_mission_checkin_wagers_user_mission_reward_period_idx
  on personal_mission_checkin_wagers(user_id, mission_id, reward_period_key);

update personal_mission_definitions
set reward_amount = 100,
    description = '每天只能签到当天一次，领取固定奖励，并结算昨日压注的双倍额外奖励。',
    updated_at = timezone('utc', now())
where id = 'mission-checkin-daily';
