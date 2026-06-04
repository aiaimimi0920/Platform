alter table tasks
  add column if not exists preferred_capability_codes jsonb not null default '[]'::jsonb;
