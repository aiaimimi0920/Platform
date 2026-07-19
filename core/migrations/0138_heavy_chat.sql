create unique index if not exists agents_owner_id_idx
  on agents(owner_user_id, id);

create table if not exists heavy_chat_slots (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  slot_key text not null,
  kind text not null check (kind in ('default', 'custom', 'purchased')),
  title text not null,
  persona_label text,
  summary text,
  sort_order integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists heavy_chat_slots_owner_slot_key_idx
  on heavy_chat_slots(owner_user_id, slot_key);
create unique index if not exists heavy_chat_slots_owner_id_idx
  on heavy_chat_slots(owner_user_id, id);

create table if not exists heavy_chat_slot_agents (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  slot_id text not null,
  agent_id text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint heavy_chat_slot_agents_owner_slot_fk
    foreign key (owner_user_id, slot_id)
    references heavy_chat_slots(owner_user_id, id)
    on delete cascade,
  constraint heavy_chat_slot_agents_owner_agent_fk
    foreign key (owner_user_id, agent_id)
    references agents(owner_user_id, id)
    on delete cascade
);

create unique index if not exists heavy_chat_slot_agents_owner_id_idx
  on heavy_chat_slot_agents(owner_user_id, id);
create unique index if not exists heavy_chat_slot_agents_owner_slot_idx
  on heavy_chat_slot_agents(owner_user_id, slot_id);
create unique index if not exists heavy_chat_slot_agents_owner_agent_idx
  on heavy_chat_slot_agents(owner_user_id, agent_id);

create table if not exists heavy_chat_projects (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  title text not null,
  subtitle text,
  instructions text,
  sort_order integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists heavy_chat_projects_owner_id_idx
  on heavy_chat_projects(owner_user_id, id);

create table if not exists heavy_chat_slot_projects (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  slot_id text not null,
  project_id text not null,
  created_at timestamptz not null,
  constraint heavy_chat_slot_projects_owner_slot_fk
    foreign key (owner_user_id, slot_id)
    references heavy_chat_slots(owner_user_id, id)
    on delete cascade,
  constraint heavy_chat_slot_projects_owner_project_fk
    foreign key (owner_user_id, project_id)
    references heavy_chat_projects(owner_user_id, id)
    on delete cascade
);

create unique index if not exists heavy_chat_slot_projects_owner_slot_project_idx
  on heavy_chat_slot_projects(owner_user_id, slot_id, project_id);

create table if not exists heavy_chat_threads (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  slot_id text not null,
  project_id text,
  title text not null,
  favorite boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint heavy_chat_threads_owner_slot_fk
    foreign key (owner_user_id, slot_id)
    references heavy_chat_slots(owner_user_id, id)
    on delete cascade,
  constraint heavy_chat_threads_owner_project_fk
    foreign key (owner_user_id, project_id)
    references heavy_chat_projects(owner_user_id, id)
    on delete restrict,
  constraint heavy_chat_threads_owner_slot_project_binding_fk
    foreign key (owner_user_id, slot_id, project_id)
    references heavy_chat_slot_projects(owner_user_id, slot_id, project_id)
    on delete restrict
);

create unique index if not exists heavy_chat_threads_owner_id_idx
  on heavy_chat_threads(owner_user_id, id);

create table if not exists heavy_chat_messages (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  thread_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  status text not null check (status in ('pending', 'streaming', 'complete', 'failed')),
  sequence integer not null check (sequence > 0),
  attempt_number integer not null default 0 check (attempt_number >= 0),
  content text not null default '',
  reference_data jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  idempotency_key text,
  error_code text,
  error_message text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint heavy_chat_messages_owner_thread_fk
    foreign key (owner_user_id, thread_id)
    references heavy_chat_threads(owner_user_id, id)
    on delete cascade
);

create unique index if not exists heavy_chat_messages_owner_id_idx
  on heavy_chat_messages(owner_user_id, id);
create unique index if not exists heavy_chat_messages_owner_idempotency_idx
  on heavy_chat_messages(owner_user_id, idempotency_key);
create unique index if not exists heavy_chat_messages_owner_thread_sequence_idx
  on heavy_chat_messages(owner_user_id, thread_id, sequence);

create table if not exists heavy_chat_message_attempts (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  message_id text not null,
  idempotency_key text not null,
  attempt_number integer not null check (attempt_number > 0),
  created_at timestamptz not null,
  constraint heavy_chat_message_attempts_owner_message_fk
    foreign key (owner_user_id, message_id)
    references heavy_chat_messages(owner_user_id, id)
    on delete cascade
);

create unique index if not exists heavy_chat_message_attempts_owner_id_idx
  on heavy_chat_message_attempts(owner_user_id, id);
create unique index if not exists heavy_chat_message_attempts_owner_idempotency_idx
  on heavy_chat_message_attempts(owner_user_id, idempotency_key);
create unique index if not exists heavy_chat_message_attempts_owner_message_attempt_idx
  on heavy_chat_message_attempts(owner_user_id, message_id, attempt_number);
