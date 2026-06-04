alter table discount_codes
  add column if not exists namespace text;

alter table discount_codes
  add column if not exists batch_label text;

create index if not exists discount_codes_namespace_idx
  on discount_codes(namespace);

create index if not exists discount_codes_batch_label_idx
  on discount_codes(batch_label);
