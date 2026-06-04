create table if not exists account_announcements (
  id text primary key,
  title text not null,
  rail_title text not null,
  summary text not null,
  eyebrow text not null,
  tone text not null,
  status text not null,
  sections jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  archived_at timestamptz,
  created_by_user_id text references users(id) on delete set null,
  updated_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint account_announcements_status_check check (status in ('draft', 'published', 'archived')),
  constraint account_announcements_tone_check check (tone in ('priority', 'update', 'guide'))
);

create index if not exists idx_account_announcements_status_published_at
  on account_announcements (status, published_at desc, updated_at desc);

create index if not exists idx_account_announcements_updated_at
  on account_announcements (updated_at desc);
