alter table opinion_topic_monthly_settlement_runs
  add column if not exists selected_count integer not null default 0,
  add column if not exists selection_limit integer not null default 5,
  add column if not exists updated_at timestamptz not null default now();

update opinion_topic_monthly_settlement_runs
set selected_count = coalesce((
    select count(*)
    from opinion_topic_monthly_settlement_items
    where opinion_topic_monthly_settlement_items.month_key = opinion_topic_monthly_settlement_runs.month_key
      and opinion_topic_monthly_settlement_items.rank <= 5
  ), 0),
  selection_limit = 5,
  updated_at = settled_at
where true;

alter table opinion_topic_monthly_settlement_items
  add column if not exists selection_status text not null default 'standby',
  add column if not exists selected_order integer,
  add column if not exists operator_note text,
  add column if not exists operator_actioned_at timestamptz,
  add column if not exists operator_actioned_by_user_id text references users(id) on delete set null;

update opinion_topic_monthly_settlement_items
set selection_status = case when rank <= 5 then 'selected' else 'standby' end,
    selected_order = case when rank <= 5 then rank else null end
where selection_status is null
   or selection_status = 'standby';

create index if not exists opinion_topic_monthly_settlement_items_month_status_rank_idx
  on opinion_topic_monthly_settlement_items (month_key, selection_status, rank);
