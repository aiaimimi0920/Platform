create table if not exists opinion_topic_monthly_settlement_runs (
  month_key text primary key,
  settled_count integer not null default 0,
  settled_at timestamptz not null
);

create table if not exists opinion_topic_monthly_settlement_items (
  id text primary key,
  month_key text not null references opinion_topic_monthly_settlement_runs(month_key) on delete cascade,
  rank integer not null,
  topic_id text not null references opinion_topics(id) on delete cascade,
  support_rate numeric(5,4) not null,
  support_ticket_total integer not null,
  unique_supporter_count integer not null,
  queue_item_id text references development_queue_items(id) on delete set null,
  created_at timestamptz not null
);

create unique index if not exists opinion_topic_monthly_settlement_items_month_rank_idx
  on opinion_topic_monthly_settlement_items (month_key, rank);

create unique index if not exists opinion_topic_monthly_settlement_items_month_topic_idx
  on opinion_topic_monthly_settlement_items (month_key, topic_id);
