create table if not exists honor_projects (
  id text primary key,
  name text not null,
  summary text not null,
  public_href text,
  sponsor_count integer not null,
  sponsored_amount integer not null,
  sponsored_currency_label text not null,
  sort_order integer not null,
  status text not null,
  archived_at timestamptz,
  created_by_user_id text references users(id) on delete set null,
  updated_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists honor_projects_status_sort_idx
  on honor_projects (status, sort_order, updated_at);

create table if not exists honor_project_investments (
  id text primary key,
  project_id text not null references honor_projects(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  invested_amount integer not null,
  currency_label text not null,
  created_by_user_id text references users(id) on delete set null,
  updated_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists honor_project_investments_project_user_idx
  on honor_project_investments (project_id, user_id);

create index if not exists honor_project_investments_user_updated_idx
  on honor_project_investments (user_id, updated_at);

create index if not exists honor_project_investments_project_updated_idx
  on honor_project_investments (project_id, updated_at);
