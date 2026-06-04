alter table item_manual_reviews
  add column if not exists routing_code text not null default 'high_replacement_frequency';

alter table item_manual_reviews
  add column if not exists routing_summary text not null default '系统检测到连续替换频率异常，已转入人工复核。';

alter table item_manual_reviews
  add column if not exists suggested_action text not null default 'inspect_pool_health';
