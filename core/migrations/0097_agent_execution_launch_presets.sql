create table if not exists "agent_execution_launch_presets" (
  "id" text primary key,
  "owner_user_id" text not null references "users"("id") on delete cascade,
  "name" text not null,
  "description" text,
  "preferred_agent_id" text references "agents"("id") on delete set null,
  "runtime_profile_key" text not null default 'baseline',
  "callback_remediation_policy_key" text,
  "title_template" text,
  "objective_template" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create unique index if not exists "agent_execution_launch_presets_owner_name_idx"
  on "agent_execution_launch_presets" ("owner_user_id", "name");

create index if not exists "agent_execution_launch_presets_owner_idx"
  on "agent_execution_launch_presets" ("owner_user_id");

create index if not exists "agent_execution_launch_presets_preferred_agent_idx"
  on "agent_execution_launch_presets" ("preferred_agent_id");

create index if not exists "agent_execution_launch_presets_updated_at_idx"
  on "agent_execution_launch_presets" ("updated_at");
