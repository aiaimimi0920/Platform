alter table discount_code_generated_batches
  add column if not exists operation_kind text;

update discount_code_generated_batches
set operation_kind = 'generatedTemplate'
where operation_kind is null;

alter table discount_code_generated_batches
  alter column operation_kind set not null;

alter table discount_code_generated_batches
  add column if not exists affected_count integer;

update discount_code_generated_batches
set affected_count = 0
where affected_count is null;

alter table discount_code_generated_batches
  alter column affected_count set not null;

alter table discount_code_generated_batches
  add column if not exists skipped_count integer;

update discount_code_generated_batches
set skipped_count = 0
where skipped_count is null;

alter table discount_code_generated_batches
  alter column skipped_count set not null;

create index if not exists discount_code_generated_batches_operation_kind_idx
  on discount_code_generated_batches (operation_kind);
