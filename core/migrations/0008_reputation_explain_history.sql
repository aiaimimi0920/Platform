alter table "reputation_snapshots"
  add column if not exists "trust_level" integer not null default 0,
  add column if not exists "base_score" integer not null default 100,
  add column if not exists "trust_bonus" integer not null default 0,
  add column if not exists "completed_contribution" integer not null default 0,
  add column if not exists "defaulted_penalty" integer not null default 0,
  add column if not exists "cancelled_penalty" integer not null default 0,
  add column if not exists "active_contribution" integer not null default 0;

create table if not exists "reputation_history" (
  "id" text primary key,
  "user_id" text not null references "users" ("id") on delete cascade,
  "reputation_score" integer not null,
  "completed_task_count" integer not null,
  "defaulted_task_count" integer not null,
  "cancelled_task_count" integer not null,
  "active_task_count" integer not null,
  "trust_level" integer not null default 0,
  "base_score" integer not null default 100,
  "trust_bonus" integer not null default 0,
  "completed_contribution" integer not null default 0,
  "defaulted_penalty" integer not null default 0,
  "cancelled_penalty" integer not null default 0,
  "active_contribution" integer not null default 0,
  "completion_rate" real not null,
  "default_rate" real not null,
  "tier" text not null,
  "recorded_at" timestamptz not null
);

create index if not exists "reputation_history_user_recorded_idx"
  on "reputation_history" ("user_id", "recorded_at" desc);
