alter table tasks
  add column if not exists idempotency_key text;

create unique index if not exists tasks_creator_idempotency_idx
  on tasks(creator_user_id, idempotency_key);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_draft_invariants_check'
      and conrelid = 'tasks'::regclass
  ) then
    alter table tasks
      add constraint tasks_draft_invariants_check
      check (
        status <> 'draft'
        or (
          idempotency_key is not null
          and assigned_user_id is null
          and reward_amount = 0
          and required_bond_amount = 0
          and operation_mode = 'manual'
        )
      );
  end if;
end $$;
