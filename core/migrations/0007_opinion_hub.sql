create table if not exists opinion_topics (
  id text primary key,
  creator_user_id text not null references users(id),
  title text not null,
  description text not null,
  difficulty_level integer not null,
  creation_ticket_cost integer not null,
  target_support_count integer not null,
  support_ticket_total integer not null,
  unique_supporter_count integer not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists opinion_topic_supports (
  id text primary key,
  topic_id text not null references opinion_topics(id) on delete cascade,
  user_id text not null references users(id),
  ticket_amount integer not null,
  created_at timestamptz not null
);
