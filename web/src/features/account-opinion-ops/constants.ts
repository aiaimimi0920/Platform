export const ISSUE_OPS_ROUTE_PATH = "/ops/account/issues";

export const QUICK_EXCLUSION_REASONS = [
  { label: "涉政", note: "涉政：命中高敏治理红线，不进入实现排期。" },
  { label: "无效辱骂", note: "无效辱骂：内容缺少有效需求，只包含攻击性或情绪化表达。" },
  { label: "重复议题", note: "重复议题：当前诉求与已有公开议题高度重复，优先收口到现有议题链路。" },
  { label: "不可执行", note: "不可执行：诉求边界过大、依赖缺失或当前阶段不具备可落地性。" },
  { label: "已有等价需求", note: "已有等价需求：需求已被当前产品能力、既有排期或等价方案覆盖。" },
] as const;

export type QuickExclusionReason = (typeof QUICK_EXCLUSION_REASONS)[number];
