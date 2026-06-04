create table if not exists gateway_analysis_exports (
  id text primary key,
  project_id text references gateway_projects(id) on delete set null,
  label text,
  text_mode text not null,
  max_text_chars integer not null,
  filters jsonb not null,
  object_prefix text not null,
  manifest_object_key text not null,
  dataset_object_key text not null,
  sample_count integer not null default 0,
  request_artifact_count integer not null default 0,
  response_artifact_count integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists gateway_analysis_exports_project_created_idx
  on gateway_analysis_exports (project_id, created_at);

create index if not exists gateway_analysis_exports_text_mode_created_idx
  on gateway_analysis_exports (text_mode, created_at);

create index if not exists gateway_analysis_exports_created_idx
  on gateway_analysis_exports (created_at);
