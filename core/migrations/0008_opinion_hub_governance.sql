alter table opinion_topics
  add column if not exists adopted_at timestamptz,
  add column if not exists adopted_by_user_id text references users(id),
  add column if not exists archived_at timestamptz;

create index if not exists opinion_topics_status_updated_idx
  on opinion_topics(status, updated_at desc);

create index if not exists opinion_topics_adopted_idx
  on opinion_topics(adopted_at desc);
