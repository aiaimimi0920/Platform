import type { UserWallet } from "@/lib/types";

export type CurrencyDefinition = {
  key: keyof UserWallet;
  name: string;
  shortLabel: string;
  accent: "violet" | "fuchsia" | "cyan";
  category: "premium" | "free" | "governance";
  summary: string;
  acquisition: string;
  usage: string;
  rule: string;
};

export const defaultUserWallet = Object.freeze<UserWallet>({
  obsidian: 0,
  mira: 0,
  opinionTickets: 0,
});

export const currencyCatalog: CurrencyDefinition[] = [
  {
    key: "obsidian",
    name: "耀晶",
    shortLabel: "YJ",
    accent: "violet",
    category: "premium",
    summary: "平台核心高价值消费货币，承接充值后的高级消费与结算行为。",
    acquisition: "通过充值、专项补偿或高价值活动奖励获得。",
    usage: "用于高价值商品、服务包、Agent 消费与单向兑换米拉。",
    rule: "内部 canonical key 继续保持 obsidian，展示层正式名称统一为耀晶。",
  },
  {
    key: "mira",
    name: "米拉",
    shortLabel: "ML",
    accent: "cyan",
    category: "free",
    summary: "平台免费资源，服务于日活、签到和轻量成长体系。",
    acquisition: "通过签到、任务、活动或社区行为获得，不以充值为主要来源。",
    usage: "用于兑换免费层内容、日常抽取、轻量互动或签到奖励消耗。",
    rule: "米拉应保持可持续免费产出，避免与付费货币形成直接充值映射。",
  },
  {
    key: "opinionTickets",
    name: "投票券",
    shortLabel: "TPQ",
    accent: "fuchsia",
    category: "governance",
    summary: "面向社区议题和开发优先级排序的高级治理资源。",
    acquisition: "通过特定活动、社区贡献、官方发放或阶段性奖励获得。",
    usage: "在满足门槛后发起议题，或为议题投票以提升其排名与优先级。",
    rule: "议题是否生效取决于门槛、支持总量、支持率与实现难度，最终按排名进入开发队列。",
  },
];

export const economyPrinciples = [
  "人民币只用于充值行为，平台内高价值交易统一通过耀晶结算。",
  "米拉属于免费循环资源，用于承接签到、任务和社区活跃。",
  "投票券不是常规消费币，而是推动议题进入开发队列的治理资源。",
];

export const opinionGovernanceRules = [
  "用户需满足平台设定的发起门槛后，才能用投票券发起正式议题。",
  "每个议题会根据实现难度对应一个目标投票券门槛，而不是统一固定数值。",
  "当总支持投票券达到门槛，且支持率达到平台要求时，议题才会判定为生效候选。",
  "多个生效议题按投票券排名和支持率排序，排名越高，越优先进入开发制作。",
];

export function getCurrencyDefinition(key: keyof UserWallet): CurrencyDefinition | undefined {
  return currencyCatalog.find((currency) => currency.key === key);
}

function normalizeUnit(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
}

export function normalizeUserWallet(wallet: Partial<UserWallet> | null | undefined): UserWallet {
  return {
    obsidian: normalizeUnit(wallet?.obsidian),
    mira: normalizeUnit(wallet?.mira),
    opinionTickets: normalizeUnit(wallet?.opinionTickets),
  };
}
