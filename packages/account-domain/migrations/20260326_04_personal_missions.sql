create table if not exists personal_mission_definitions (
  id text primary key,
  kind text not null,
  status text not null,
  title text not null,
  subtitle text,
  description text not null,
  eyebrow text not null,
  reward_currency text not null,
  reward_amount integer not null,
  metric_key text not null,
  progress_target integer not null,
  reset_rule text not null,
  streak_mode text not null,
  streak_target integer,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null,
  archived_at timestamptz,
  created_by_user_id text references users(id) on delete set null,
  updated_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists personal_mission_definitions_kind_idx
  on personal_mission_definitions(kind);

create index if not exists personal_mission_definitions_status_idx
  on personal_mission_definitions(status);

create table if not exists personal_mission_claims (
  id text primary key,
  mission_id text not null references personal_mission_definitions(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  period_key text not null,
  progress_snapshot jsonb,
  reward_currency text not null,
  reward_amount integer not null,
  claimed_at timestamptz not null
);

create unique index if not exists personal_mission_claims_user_mission_period_idx
  on personal_mission_claims(user_id, mission_id, period_key);

create index if not exists personal_mission_claims_user_claimed_at_idx
  on personal_mission_claims(user_id, claimed_at desc);

insert into personal_mission_definitions (
  id,
  kind,
  status,
  title,
  subtitle,
  description,
  eyebrow,
  reward_currency,
  reward_amount,
  metric_key,
  progress_target,
  reset_rule,
  streak_mode,
  streak_target,
  starts_at,
  ends_at,
  sort_order,
  archived_at,
  created_by_user_id,
  updated_by_user_id,
  created_at,
  updated_at
)
values
  (
    'mission-checkin-daily',
    'checkin',
    'active',
    '每日签到',
    '每日激活一次个人终端回路',
    '每天登录后可领取一次签到奖励，并累计连续签到天数。',
    '签到',
    'mira',
    20,
    'dailyCheckInClaim',
    1,
    'daily',
    'daily_checkin',
    7,
    null,
    null,
    10,
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'mission-daily-task-apply',
    'daily',
    'active',
    '今日申请任务 1 次',
    '保持协作链路活跃',
    '今日至少提交 1 次任务申请，可领取日常奖励。',
    '每日任务',
    'mira',
    8,
    'taskApply',
    1,
    'daily',
    'none',
    null,
    null,
    null,
    20,
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'mission-daily-mail-claim',
    'daily',
    'active',
    '今日领取邮箱附件 1 次',
    '保持站内回路畅通',
    '今日至少领取 1 个邮箱附件，可领取日常奖励。',
    '每日任务',
    'mira',
    6,
    'mailClaim',
    1,
    'daily',
    'none',
    null,
    null,
    null,
    30,
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'mission-daily-product-purchase',
    'daily',
    'active',
    '今日完成商品购买 1 次',
    '驱动平台消费与回流',
    '今日至少完成 1 次商品购买，可领取日常奖励。',
    '每日任务',
    'mira',
    12,
    'productPurchase',
    1,
    'daily',
    'none',
    null,
    null,
    null,
    40,
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'mission-weekly-checkin',
    'weekly',
    'active',
    '本周完成签到 3 次',
    '维持整周活跃',
    '本周至少完成 3 次每日签到，可领取周任务奖励。',
    '周任务',
    'mira',
    24,
    'dailyCheckInClaim',
    3,
    'weekly',
    'none',
    null,
    null,
    null,
    50,
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'mission-weekly-task-apply',
    'weekly',
    'active',
    '本周申请任务 3 次',
    '维持任务参与度',
    '本周至少提交 3 次任务申请，可领取周任务奖励。',
    '周任务',
    'mira',
    18,
    'taskApply',
    3,
    'weekly',
    'none',
    null,
    null,
    null,
    60,
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'mission-weekly-product-purchase',
    'weekly',
    'active',
    '本周完成购买 2 次',
    '维持市场回流',
    '本周至少完成 2 次商品购买，可领取周任务奖励。',
    '周任务',
    'mira',
    28,
    'productPurchase',
    2,
    'weekly',
    'none',
    null,
    null,
    null,
    70,
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'mission-weekly-opinion-support',
    'weekly',
    'active',
    '本周参与议题支持 2 次',
    '维持治理参与度',
    '本周至少使用意见券支持 2 次议题，可领取周任务奖励。',
    '周任务',
    'mira',
    16,
    'opinionSupport',
    2,
    'weekly',
    'none',
    null,
    null,
    null,
    80,
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'mission-permanent-task-explorer',
    'permanent',
    'active',
    '累计申请任务 5 次',
    '探索平台协作侧',
    '累计完成 5 次任务申请，用于引导用户探索平台协作能力。',
    '永久任务',
    'mira',
    50,
    'taskApply',
    5,
    'none',
    'none',
    null,
    null,
    null,
    90,
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'mission-permanent-mail-relay',
    'permanent',
    'active',
    '累计领取邮箱附件 5 次',
    '探索站内消息回路',
    '累计领取 5 次邮箱附件，用于引导用户建立站内消息习惯。',
    '永久任务',
    'mira',
    30,
    'mailClaim',
    5,
    'none',
    'none',
    null,
    null,
    null,
    100,
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'mission-event-sprint-market-loop',
    'event',
    'active',
    '活动期内完成商品购买 2 次',
    '阶段活动 · 市场回流冲刺',
    '在当前活动窗口内完成 2 次商品购买，可领取限时活动奖励。',
    '活动任务',
    'mira',
    36,
    'productPurchase',
    2,
    'event_window',
    'none',
    null,
    timezone('utc', now()) - interval '2 days',
    timezone('utc', now()) + interval '21 days',
    110,
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now())
  )
on conflict (id) do nothing;

insert into personal_mission_claims (
  id,
  mission_id,
  user_id,
  period_key,
  progress_snapshot,
  reward_currency,
  reward_amount,
  claimed_at
)
select
  drc.id,
  'mission-checkin-daily',
  drc.user_id,
  drc.reward_date,
  jsonb_build_object(
    'progressCurrent', 1,
    'progressTarget', 1,
    'streakDays', drc.streak_days_after_claim
  ),
  drc.reward_currency,
  drc.reward_amount,
  drc.claimed_at
from daily_reward_claims drc
on conflict (user_id, mission_id, period_key) do nothing;

insert into personal_mission_claims (
  id,
  mission_id,
  user_id,
  period_key,
  progress_snapshot,
  reward_currency,
  reward_amount,
  claimed_at
)
select
  dmc.id,
  case dmc.mission_key
    when 'taskApply' then 'mission-daily-task-apply'
    when 'mailClaim' then 'mission-daily-mail-claim'
    when 'productPurchase' then 'mission-daily-product-purchase'
  end,
  dmc.user_id,
  dmc.reward_date,
  jsonb_build_object('progressTarget', 1),
  dmc.reward_currency,
  dmc.reward_amount,
  dmc.claimed_at
from daily_mission_claims dmc
where dmc.mission_key in ('taskApply', 'mailClaim', 'productPurchase')
on conflict (user_id, mission_id, period_key) do nothing;

insert into personal_mission_claims (
  id,
  mission_id,
  user_id,
  period_key,
  progress_snapshot,
  reward_currency,
  reward_amount,
  claimed_at
)
select
  wmc.id,
  case wmc.mission_key
    when 'dailyCheckIn' then 'mission-weekly-checkin'
    when 'taskApply' then 'mission-weekly-task-apply'
    when 'productPurchase' then 'mission-weekly-product-purchase'
    when 'opinionSupport' then 'mission-weekly-opinion-support'
  end,
  wmc.user_id,
  wmc.week_key,
  jsonb_build_object('progressTarget', 1),
  wmc.reward_currency,
  wmc.reward_amount,
  wmc.claimed_at
from weekly_mission_claims wmc
where wmc.mission_key in ('dailyCheckIn', 'taskApply', 'productPurchase', 'opinionSupport')
on conflict (user_id, mission_id, period_key) do nothing;
