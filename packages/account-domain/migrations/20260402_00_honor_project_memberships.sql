create table if not exists honor_project_memberships (
  id text primary key,
  project_id text not null references honor_projects(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role_label text not null,
  note text,
  status text not null,
  created_by_user_id text references users(id) on delete set null,
  updated_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists honor_project_memberships_project_user_idx
  on honor_project_memberships(project_id, user_id);

create index if not exists honor_project_memberships_user_updated_idx
  on honor_project_memberships(user_id, updated_at);

create index if not exists honor_project_memberships_project_updated_idx
  on honor_project_memberships(project_id, updated_at);
