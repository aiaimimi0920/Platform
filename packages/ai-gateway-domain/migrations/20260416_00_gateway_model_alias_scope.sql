alter table if exists gateway_model_aliases
  add column if not exists scope_type text;

update gateway_model_aliases
set scope_type = 'global'
where scope_type is null
   or btrim(scope_type) = ''
   or scope_type not in ('global', 'provider_special');

alter table if exists gateway_model_aliases
  alter column scope_type set default 'global';

alter table if exists gateway_model_aliases
  alter column scope_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gateway_model_aliases_scope_type_check'
  ) then
    alter table gateway_model_aliases
      add constraint gateway_model_aliases_scope_type_check
      check (scope_type in ('global', 'provider_special'));
  end if;
end
$$;
