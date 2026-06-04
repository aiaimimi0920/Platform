alter table discount_code_generated_batches
  add column if not exists operator_channel text;

alter table discount_code_generated_batches
  add column if not exists source_filename text;

create index if not exists discount_code_generated_batches_operator_user_idx
  on discount_code_generated_batches (operator_user_id);

create index if not exists discount_code_generated_batches_operator_channel_idx
  on discount_code_generated_batches (operator_channel);

create index if not exists discount_code_generated_batches_source_filename_idx
  on discount_code_generated_batches (source_filename);
