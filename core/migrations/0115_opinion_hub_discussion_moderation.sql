alter table opinion_topics
  add column if not exists summary text,
  add column if not exists requirements text,
  add column if not exists review_status text not null default 'published',
  add column if not exists discussion_status text not null default 'open',
  add column if not exists moderation_reason_category text,
  add column if not exists moderation_reason_detail text,
  add column if not exists moderation_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_user_id text references users(id),
  add column if not exists comment_count integer not null default 0,
  add column if not exists last_commented_at timestamptz,
  add column if not exists banned_at timestamptz,
  add column if not exists deleted_at timestamptz;

update opinion_topics
set summary = left(description, 220)
where summary is null;

alter table opinion_topics
  alter column summary set not null;

create table if not exists opinion_topic_comments (
  id text primary key,
  topic_id text not null references opinion_topics(id) on delete cascade,
  author_user_id text not null references users(id),
  content text not null,
  ticket_cost integer not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists opinion_topic_comments_topic_created_idx
  on opinion_topic_comments (topic_id, created_at desc);

create table if not exists opinion_hub_settings (
  id text primary key,
  pre_moderation_enabled boolean not null default false,
  comment_ticket_cost integer not null default 1,
  updated_at timestamptz not null,
  updated_by_user_id text references users(id)
);

insert into opinion_hub_settings (
  id,
  pre_moderation_enabled,
  comment_ticket_cost,
  updated_at,
  updated_by_user_id
)
values (
  'default',
  false,
  1,
  now(),
  null
)
on conflict (id) do nothing;
