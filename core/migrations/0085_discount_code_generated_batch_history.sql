create table if not exists discount_code_generated_batches (
  id text primary key,
  template_key text not null,
  namespace text,
  batch_label text,
  id_prefix text not null,
  code_prefix text not null,
  operator_user_id text not null,
  total_rows integer not null,
  created_count integer not null,
  updated_count integer not null,
  unchanged_count integer not null,
  created_at timestamptz not null default now()
);

create index if not exists discount_code_generated_batches_namespace_idx
  on discount_code_generated_batches (namespace);

create index if not exists discount_code_generated_batches_batch_label_idx
  on discount_code_generated_batches (batch_label);

create index if not exists discount_code_generated_batches_template_key_idx
  on discount_code_generated_batches (template_key);

create index if not exists discount_code_generated_batches_created_at_idx
  on discount_code_generated_batches (created_at);

create table if not exists discount_code_generated_batch_items (
  id text primary key,
  batch_id text not null references discount_code_generated_batches(id) on delete cascade,
  line_number integer not null,
  discount_code_id text not null,
  code text not null,
  namespace text,
  batch_label text,
  status text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists discount_code_generated_batch_items_batch_line_idx
  on discount_code_generated_batch_items (batch_id, line_number);

create index if not exists discount_code_generated_batch_items_batch_idx
  on discount_code_generated_batch_items (batch_id);

create index if not exists discount_code_generated_batch_items_code_idx
  on discount_code_generated_batch_items (code);
