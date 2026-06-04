import type { CurrencyKey } from "@neuro/contracts";

export const rewardCurrencyOptions: Array<{
  value: CurrencyKey;
  label: string;
  description: string;
}> = [
  {
    value: "mira",
    label: "米拉",
    description: "免费循环资源，适合签到、日常活跃与轻量奖励。",
  },
  {
    value: "obsidian",
    label: "曜石",
    description: "付费层货币，适合高价值活动奖励或运营补偿。",
  },
  {
    value: "opinionTickets",
    label: "意见券",
    description: "治理资源，适合议题参与和社区行为激励。",
  },
];

const rewardCurrencyLabelMap: Record<CurrencyKey, string> = {
  mira: "米拉",
  obsidian: "曜石",
  opinionTickets: "意见券",
};

export function getCurrencyLabel(currency: CurrencyKey) {
  return rewardCurrencyLabelMap[currency];
}
