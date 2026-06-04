alter table tasks
  add column if not exists meter_quantity integer;

update tasks
set meter_quantity = 1
where pricing_mode in ('token_metered', 'property_metered')
  and meter_quantity is null;
