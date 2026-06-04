create table if not exists development_queue_items (
  id text primary key,
  source_type text not null,
  source_id text not null,
  owner_user_id text not null references users(id) on delete cascade,
  title text not null,
  description text not null,
  difficulty_level integer,
  support_ticket_total integer not null,
  oppose_ticket_total integer not null,
  support_rate numeric(5, 4) not null,
  priority_score integer not null,
  status text not null,
  queued_at timestamptz not null,
  started_at timestamptz null,
  delivered_at timestamptz null,
  archived_at timestamptz null,
  updated_at timestamptz not null
);

create unique index if not exists development_queue_items_source_idx
  on development_queue_items(source_type, source_id);
