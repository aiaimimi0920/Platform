create table if not exists public_surface_visibility (
  surface_key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
