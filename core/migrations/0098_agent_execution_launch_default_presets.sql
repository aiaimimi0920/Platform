create table if not exists "agent_execution_launch_default_presets" (
  "owner_user_id" text primary key references "users"("id") on delete cascade,
  "preset_id" text not null references "agent_execution_launch_presets"("id") on delete cascade,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create index if not exists "agent_execution_launch_default_presets_preset_idx"
  on "agent_execution_launch_default_presets" ("preset_id");

create index if not exists "agent_execution_launch_default_presets_updated_at_idx"
  on "agent_execution_launch_default_presets" ("updated_at");
