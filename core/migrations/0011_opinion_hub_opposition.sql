alter table opinion_topics
  add column if not exists oppose_ticket_total integer not null default 0;

alter table opinion_topics
  add column if not exists unique_opposer_count integer not null default 0;

alter table opinion_topics
  add column if not exists support_rate_threshold numeric(5,4) not null default 0.7000;

create table if not exists opinion_topic_opposes (
  id text primary key,
  topic_id text not null references opinion_topics(id) on delete cascade,
  user_id text not null references users(id),
  ticket_amount integer not null,
  created_at timestamptz not null
);
