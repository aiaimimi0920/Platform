-- Benefits tables are now created in core migrations (0128_benefits_base.sql)
-- This migration only handles seed data

insert into benefit_families (
  key,
  title,
  tone,
  description,
  sort_order,
  created_at,
  updated_at
)
values
  ('artificial_intelligence', '人工智能', 'signal', '以账号、密钥、接口与服务控制卡为主的人工智能权益。', 10, timezone('utc', now()), timezone('utc', now())),
  ('network_search', '网络搜索', 'cyan', null, 20, timezone('utc', now()), timezone('utc', now())),
  ('network_proxy', '网络代理', 'ink', null, 30, timezone('utc', now()), timezone('utc', now()))
on conflict (key) do nothing;

insert into benefit_services (
  id,
  family_key,
  service_kind,
  status,
  title,
  sort_order,
  config,
  created_by_user_id,
  updated_by_user_id,
  created_at,
  updated_at,
  archived_at
)
values (
  'benefit-service-codex',
  'artificial_intelligence',
  'credential_service_v1',
  'active',
  'codex',
  10,
  jsonb_build_object(
    'title', 'codex',
    'refillModeText', '无限续杯',
    'availabilityLabel', '可用账号数',
    'availabilityText', '30/30',
    'apiModeText', '无限调用',
    'apiUrl', 'https://xxxx',
    'downloadEnabled', true,
    'downloadUrl', null
  ),
  null,
  null,
  timezone('utc', now()),
  timezone('utc', now()),
  null
)
on conflict (id) do nothing;

insert into benefit_product_bindings (
  id,
  service_id,
  product_id,
  created_by_user_id,
  created_at
)
select
  'benefit-binding-codex-product-vip-30',
  'benefit-service-codex',
  'product_vip_30',
  null,
  timezone('utc', now())
where exists (
  select 1
  from products
  where id = 'product_vip_30'
)
on conflict (service_id, product_id) do nothing;
