alter table discount_code_generated_batches
  add column if not exists reason text;

alter table discount_code_generated_batches
  add column if not exists note text;
