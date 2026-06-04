create table if not exists "weekly_mission_claims" (
  "id" text primary key,
  "user_id" text not null references "users" ("id") on delete cascade,
  "mission_key" text not null,
  "week_key" text not null,
  "reward_currency" text not null,
  "reward_amount" integer not null,
  "claimed_at" timestamptz not null
);

create unique index if not exists "weekly_mission_claims_user_mission_week_idx"
  on "weekly_mission_claims" ("user_id", "week_key", "mission_key");
