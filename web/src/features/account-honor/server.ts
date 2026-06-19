import { z } from "zod";

import type { OpinionTopicSupportSummaryView, OpinionTopicView } from "@neuro/contracts";

import {
  getCurrentUser,
  getFeatureSnapshot,
  getHonorProjectPanel,
  getReputationSummary,
  listAgentExecutions,
  listAgents,
  listArbitrationCases,
  listItems,
  listMyTasks,
  listOpinionTopicSupportSummaries,
  listOpinionTopics,
  updateCurrentUserProfile,
} from "@/features/account-honor/adapter";
import {
  isLocalPreviewRequest,
  resolveHonorAuthAwareStatus,
  withFallback,
  withNoCacheJson,
} from "@/features/account-honor/helper";
import { requirePlatformUserContext } from "@/lib/platform-session";
import type {
  AccountHonorAbilityMetric,
  AccountHonorActivityHeatmap,
  AccountHonorActivityLevel,
  AccountHonorActivityMonthMarker,
  AccountHonorActivityWeek,
  AccountHonorAgentCatalogEntry,
  AccountHonorCenterProps,
  AccountHonorAgentShowcase,
  AccountHonorIssueShowcase,
  AccountHonorIssueSupportSummary,
  AccountHonorProjectShowcase,
  AccountHonorSponsorshipSummary,
  AccountHonorTaskPerformance,
} from "@/features/account-honor/types";

const HONOR_ACTIVITY_WEEK_COUNT = 28;
const ISSUE_PUBLIC_PATH = "/opinions";
const ISSUE_CURRENCY_LABEL = "投票券";

type ActivityBucket = {
  count: number;
  labels: Map<string, number>;
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getTaskValue(task: { rewardAmount: number } | null | undefined) {
  if (!task) {
    return 0;
  }

  return Number.isFinite(task.rewardAmount) ? task.rewardAmount : 0;
}

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeekMonday(value: Date) {
  const next = startOfDay(value);
  const offset = (next.getDay() + 6) % 7;
  return addDays(next, -offset);
}

function formatDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00+08:00`);
}

function toDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(value: string | null | undefined) {
  const parsed = toDate(value);
  return parsed ? formatDateKey(parsed) : null;
}

function formatFullDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(value);
}

function formatMonthDay(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(value);
}

function formatMonthShort(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "Asia/Shanghai",
  }).format(value);
}

function pushActivitySignal(
  buckets: Map<string, ActivityBucket>,
  timestamp: string | null | undefined,
  weight: number,
  label: string,
) {
  const parsed = toDate(timestamp);
  if (!parsed) {
    return;
  }

  const key = formatDateKey(parsed);
  const bucket = buckets.get(key) ?? {
    count: 0,
    labels: new Map<string, number>(),
  };

  bucket.count += Math.max(1, Math.floor(weight));
  bucket.labels.set(label, (bucket.labels.get(label) ?? 0) + 1);
  buckets.set(key, bucket);
}

function buildActivityLevel(count: number, maxCount: number, future: boolean): AccountHonorActivityLevel {
  if (future || count <= 0) {
    return 0;
  }

  if (maxCount <= 4) {
    return Math.min(4, count) as AccountHonorActivityLevel;
  }

  const ratio = count / maxCount;
  if (ratio >= 0.85) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

function buildActivityTitle(args: {
  date: Date;
  bucket: ActivityBucket | null;
  future: boolean;
}) {
  if (args.future) {
    return `${formatFullDate(args.date)} · 未到达`;
  }

  if (!args.bucket || args.bucket.count <= 0) {
    return `${formatFullDate(args.date)} · 无活跃信号`;
  }

  const details = [...args.bucket.labels.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([label, count]) => (count > 1 ? `${label}×${count}` : label));

  return `${formatFullDate(args.date)} · ${args.bucket.count} 个活跃信号 · ${details.join(" / ")}`;
}

function buildHonorAbilityMetrics(args: {
  progression: AccountHonorCenterProps["progression"];
  reputation: AccountHonorCenterProps["reputation"];
  trustLevel: number | null;
  enabledAgentCount: number;
  agentCapabilityCount: number;
  totalAssetCount: number;
  listedAssetCount: number;
  unlockedAccessCount: number;
  benefitCount: number;
  taskActiveCount: number;
}) {
  const growthScore = args.progression
    ? clampPercent(args.progression.level * 12 + args.progression.progressRate * 28)
    : 0;
  const reputationScore = args.reputation
    ? clampPercent(args.reputation.reputationScore / 1.8)
    : clampPercent((args.trustLevel ?? 0) * 12);
  const collaborationScore = args.reputation
    ? clampPercent(
        args.reputation.completionRate * 75 +
          Math.min(25, args.reputation.completedTaskCount * 5 + args.reputation.activeTaskCount * 3),
      )
    : clampPercent(args.taskActiveCount * 12);
  const agentScore = clampPercent(args.enabledAgentCount * 24 + args.agentCapabilityCount * 8);
  const assetScore = clampPercent(args.totalAssetCount * 18 + args.listedAssetCount * 10);
  const accessScore = clampPercent(
    args.unlockedAccessCount * 24 + args.benefitCount * 10 + Math.max(0, args.trustLevel ?? 0) * 6,
  );

  const metrics: AccountHonorAbilityMetric[] = [
    {
      key: "growth",
      label: "成长势能",
      shortLabel: "成长",
      score: growthScore,
      value: args.progression ? `Lv.${args.progression.level}` : "--",
      note: args.progression
        ? args.progression.experienceToNextLevel === null
          ? "当前已达最高等级"
          : `距下一阶 ${args.progression.experienceToNextLevel} XP`
        : "成长快照未同步",
    },
    {
      key: "reputation",
      label: "信誉稳定度",
      shortLabel: "信誉",
      score: reputationScore,
      value: args.reputation ? `${args.reputation.reputationScore}` : "--",
      note: args.reputation
        ? `${args.reputation.tier} / 完成率 ${(args.reputation.completionRate * 100).toFixed(1)}%`
        : "信誉模块未同步",
    },
    {
      key: "collaboration",
      label: "协作履约",
      shortLabel: "协作",
      score: collaborationScore,
      value: args.reputation
        ? `${args.reputation.completedTaskCount} 完成`
        : `${args.taskActiveCount} 活跃`,
      note: args.reputation
        ? `${args.reputation.activeTaskCount} 个进行中任务`
        : "等待任务履约数据",
    },
    {
      key: "agents",
      label: "智能体建设",
      shortLabel: "智能体",
      score: agentScore,
      value: `${args.enabledAgentCount} 启用`,
      note: `${args.agentCapabilityCount} 项能力登记`,
    },
    {
      key: "assets",
      label: "资产掌控",
      shortLabel: "资产",
      score: assetScore,
      value: `${args.totalAssetCount} 项`,
      note: `${args.listedAssetCount} 项挂牌展示`,
    },
    {
      key: "access",
      label: "权限解锁",
      shortLabel: "权限",
      score: accessScore,
      value: `${args.unlockedAccessCount} 已解锁`,
      note: `${args.benefitCount} 条成长权益已生效`,
    },
  ];

  return metrics;
}

function buildDerivedAgentReputationScore(args: {
  fulfillmentRate: number | null;
  positiveRate: number | null;
}) {
  if (args.fulfillmentRate === null && args.positiveRate === null) {
    return null;
  }

  if (args.fulfillmentRate !== null && args.positiveRate !== null) {
    return clampPercent(args.fulfillmentRate * 55 + args.positiveRate * 45);
  }

  return clampPercent((args.fulfillmentRate ?? args.positiveRate ?? 0) * 100);
}

function buildTaskPerformance(args: {
  reputation: AccountHonorCenterProps["reputation"];
  tasks: Awaited<ReturnType<typeof listMyTasks>>;
  userId: string;
}): AccountHonorTaskPerformance {
  const reputationScoreOutOf = 100;
  const producedValue = args.tasks
    .filter((task) => task.assignedUserId === args.userId && task.status === "accepted")
    .reduce((sum, task) => sum + getTaskValue(task), 0);
  const spentValue = args.tasks
    .filter((task) => task.creatorUserId === args.userId && task.status === "accepted")
    .reduce((sum, task) => sum + getTaskValue(task), 0);

  if (!args.reputation) {
    return {
      acceptedCount: 0,
      fulfilledCount: 0,
      fulfillmentRate: null,
      positiveRate: null,
      reputationScore: null,
      reputationScoreOutOf,
      spentValue,
      netValue: producedValue - spentValue,
    };
  }

  const acceptedCount =
    args.reputation.completedTaskCount +
    args.reputation.defaultedTaskCount +
    args.reputation.cancelledTaskCount +
    args.reputation.activeTaskCount;
  const fulfilledCount = args.reputation.completedTaskCount;
  const arbitrationTotal =
    args.reputation.favorableArbitrationCount + args.reputation.unfavorableArbitrationCount;
  const positiveRate =
    arbitrationTotal > 0 ? args.reputation.favorableArbitrationCount / arbitrationTotal : null;

  return {
    acceptedCount,
    fulfilledCount,
    fulfillmentRate: args.reputation.completionRate ?? null,
    positiveRate,
    reputationScore: Math.max(0, Math.min(reputationScoreOutOf, Math.round(args.reputation.reputationScore))),
    reputationScoreOutOf,
    spentValue,
    netValue: producedValue - spentValue,
  };
}

function inferAgentDirection(name: string, description: string | null) {
  const seed = `${name} ${description ?? ""}`.toLowerCase();
  if (seed.includes("画") || seed.includes("绘") || seed.includes("image") || seed.includes("draw")) {
    return "绘画";
  }
  if (seed.includes("chat") || seed.includes("对话") || seed.includes("客服") || seed.includes("assistant")) {
    return "聊天";
  }
  return "通用";
}

function selectAgentShowcase(
  catalog: AccountHonorAgentCatalogEntry[],
  showcasedAgentIds: string[] | null | undefined,
): AccountHonorAgentShowcase[] {
  const fallback = catalog.slice(0, 4);
  if (!showcasedAgentIds || showcasedAgentIds.length === 0) {
    return fallback;
  }

  const catalogById = new Map(catalog.map((agent) => [agent.id, agent] as const));
  return showcasedAgentIds
    .map((agentId) => catalogById.get(agentId) ?? null)
    .filter((agent): agent is AccountHonorAgentCatalogEntry => Boolean(agent))
    .slice(0, 4);
}

function buildDefaultAgentFixtureCatalog(): AccountHonorAgentCatalogEntry[] {
  return [
    {
      id: "agent-demo-general",
      name: "终端协调官",
      direction: "通用",
      enabled: true,
      reputationScore: 91,
      positiveRate: 0.94,
      fulfillmentCount: 37,
      fulfillmentRate: 0.92,
      producedValue: 24600,
      spentValue: 9800,
      netValue: 14800,
    },
    {
      id: "agent-demo-chat",
      name: "对话接待员",
      direction: "聊天",
      enabled: true,
      reputationScore: 88,
      positiveRate: 0.97,
      fulfillmentCount: 52,
      fulfillmentRate: 0.95,
      producedValue: 31800,
      spentValue: 13600,
      netValue: 18200,
    },
    {
      id: "agent-demo-visual",
      name: "绘图构形师",
      direction: "绘画",
      enabled: true,
      reputationScore: 84,
      positiveRate: 0.9,
      fulfillmentCount: 29,
      fulfillmentRate: 0.87,
      producedValue: 28100,
      spentValue: 17100,
      netValue: 11000,
    },
    {
      id: "agent-demo-planner",
      name: "流程调度器",
      direction: "规划",
      enabled: true,
      reputationScore: 86,
      positiveRate: 0.92,
      fulfillmentCount: 41,
      fulfillmentRate: 0.9,
      producedValue: 35400,
      spentValue: 14900,
      netValue: 20500,
    },
  ];
}

function applyDefaultAgentFixture(
  catalog: AccountHonorAgentCatalogEntry[],
  shouldApplyFixture: boolean,
) {
  if (!shouldApplyFixture || catalog.length >= 4) {
    return catalog;
  }

  const existingIds = new Set(catalog.map((agent) => agent.id));
  const missingCount = 4 - catalog.length;
  const fixture = buildDefaultAgentFixtureCatalog()
    .filter((agent) => !existingIds.has(agent.id))
    .slice(0, missingCount);

  return [...catalog, ...fixture];
}

function buildAgentShowcase(args: {
  agents: Awaited<ReturnType<typeof listAgents>>;
  executions: Awaited<ReturnType<typeof listAgentExecutions>>;
  tasks: Awaited<ReturnType<typeof listMyTasks>>;
  arbitrations: Awaited<ReturnType<typeof listArbitrationCases>>;
  showcasedAgentIds: string[] | null | undefined;
  includeDefaultFixture?: boolean;
}) {
  const tasksById = new Map(args.tasks.map((task) => [task.id, task] as const));
  const arbitrationsByTaskId = new Map<string, Awaited<ReturnType<typeof listArbitrationCases>>>();

  for (const arbitration of args.arbitrations) {
    if (arbitration.entityType !== "task") {
      continue;
    }

    const bucket = arbitrationsByTaskId.get(arbitration.entityId) ?? [];
    bucket.push(arbitration);
    arbitrationsByTaskId.set(arbitration.entityId, bucket);
  }

  const catalog: AccountHonorAgentCatalogEntry[] = args.agents.map((agent) => {
    const agentExecutions = args.executions.filter((execution) => execution.agentId === agent.id);
    const taskExecutionByTaskId = new Map<string, (typeof agentExecutions)[number]>();

    for (const execution of agentExecutions) {
      if (!execution.taskId) {
        continue;
      }

      const current = taskExecutionByTaskId.get(execution.taskId);
      if (!current || new Date(execution.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
        taskExecutionByTaskId.set(execution.taskId, execution);
      }
    }

    const taskExecutions = [...taskExecutionByTaskId.values()];
    const terminalExecutionCount = taskExecutions.filter((execution) =>
      ["completed", "failed", "cancelled"].includes(execution.status),
    ).length;
    const fulfillmentCount = taskExecutions.filter((execution) => execution.status === "completed").length;
    const fulfillmentBase = terminalExecutionCount > 0 ? terminalExecutionCount : taskExecutions.length;
    const fulfillmentRate = fulfillmentBase > 0 ? fulfillmentCount / fulfillmentBase : null;

    const relatedArbitrations = taskExecutions.flatMap((execution) =>
      execution.taskId ? (arbitrationsByTaskId.get(execution.taskId) ?? []) : [],
    );
    const favorableCount = relatedArbitrations.filter(
      (arbitration) => arbitration.reputationImpactForViewer === "favorable",
    ).length;
    const unfavorableCount = relatedArbitrations.filter(
      (arbitration) => arbitration.reputationImpactForViewer === "unfavorable",
    ).length;
    const positiveRate =
      favorableCount + unfavorableCount > 0 ? favorableCount / (favorableCount + unfavorableCount) : null;

    const producedValueFromSettlements = agentExecutions.reduce(
      (sum, execution) => sum + (execution.settlement?.revenueAmount ?? 0),
      0,
    );
    const spentValue = agentExecutions.reduce(
      (sum, execution) => sum + (execution.settlement?.billedAmount ?? 0),
      0,
    );
    const fallbackProducedValue = taskExecutions
      .filter((execution) => execution.status === "completed")
      .reduce((sum, execution) => sum + getTaskValue(tasksById.get(execution.taskId ?? "")), 0);
    const producedValue = producedValueFromSettlements > 0 ? producedValueFromSettlements : fallbackProducedValue;

    return {
      id: agent.id,
      name: agent.name,
      direction: inferAgentDirection(agent.name, agent.description),
      enabled: agent.enabled,
      reputationScore: buildDerivedAgentReputationScore({
        fulfillmentRate,
        positiveRate,
      }),
      positiveRate,
      fulfillmentCount,
      fulfillmentRate,
      producedValue,
      spentValue,
      netValue: producedValue - spentValue,
    };
  });

  const catalogWithFixture = applyDefaultAgentFixture(catalog, args.includeDefaultFixture ?? false);

  return {
    agentCatalog: catalogWithFixture,
    agentShowcase: selectAgentShowcase(catalogWithFixture, args.showcasedAgentIds),
  };
}

function selectProjectShowcase(
  catalog: AccountHonorProjectShowcase[],
  showcasedProjectIds: string[] | null | undefined,
  limit = 4,
) {
  const fallback = catalog.slice(0, limit);
  if (!showcasedProjectIds || showcasedProjectIds.length === 0) {
    return fallback;
  }

  const catalogById = new Map(catalog.map((project) => [project.id, project] as const));
  return showcasedProjectIds
    .map((projectId) => catalogById.get(projectId) ?? null)
    .filter((project): project is AccountHonorProjectShowcase => Boolean(project))
    .slice(0, limit);
}

function buildProjectCatalog(): AccountHonorProjectShowcase[] {
  return [
    {
      id: "project-demo-1",
      name: "论文美化软件",
      summary: "面向学术论文的排版与图表增强工具。",
      publicHref: "/projects/paper-polish",
      ownerHandle: "zhiwei",
      ownerLabel: "知微",
      categoryLabel: "人工智能",
      stageLabel: "原型打磨",
      progressPercent: 48,
      progressLabel: "排版引擎与图表美化链路已联通，当前在做批量模板与审阅工作流。",
      rewardShareLabel: "成功上线后 8% 净收益回流支持者",
      sponsorOpen: true,
      sponsorStatusLabel: "开放赞助",
      joinOpen: true,
      joinStatusLabel: "接收协作者",
      collaborationLabel: "设计 / Prompt / Python 工具链协作",
      fundingTargetAmount: 12000,
      workspaceHref: "https://github.com/neuroloom-labs/paper-polish",
      workspaceLabel: "GitHub 工作目录",
      detailBody:
        "该项目面向论文写作与投稿流程，核心目标是把排版、图表增强、引用整理与审稿反馈整合成一个可复用的 AI 工具链。当前阶段重点不是公开大规模获客，而是先把编辑、模板与批处理体验打磨到稳定可交付。",
      sponsorCount: 18,
      sponsoredAmount: 6400,
      sponsoredCurrencyLabel: "MIRA",
    },
    {
      id: "project-demo-2",
      name: "终端协作工作台",
      summary: "为小团队提供的本地优先协作终端。",
      publicHref: "/projects/terminal-collab",
      ownerHandle: "sora",
      ownerLabel: "空川",
      categoryLabel: "网络搜索",
      stageLabel: "协作验证",
      progressPercent: 73,
      progressLabel: "多终端协作与权限同步正在小范围验证，当前在压缩冷启动与同步延迟。",
      rewardShareLabel: "正式商用后 12% 收益分成",
      sponsorOpen: true,
      sponsorStatusLabel: "开放赞助",
      joinOpen: true,
      joinStatusLabel: "接收开发者",
      collaborationLabel: "前端终端壳 / 同步引擎 / 文档编排",
      fundingTargetAmount: 15000,
      workspaceHref: "https://github.com/neuroloom-labs/terminal-collab",
      workspaceLabel: "GitHub 工作目录",
      detailBody:
        "终端协作工作台希望把“轻协作 + 本地优先 + 指令式面板”整合成一个适合小团队的工作区。项目当前已经能跑通账户终端、任务、审计与基础同步，正在补齐更稳定的多人协作体验。",
      sponsorCount: 26,
      sponsoredAmount: 9800,
      sponsoredCurrencyLabel: "MIRA",
    },
    {
      id: "project-demo-3",
      name: "智能体训练仪表盘",
      summary: "可视化训练与回放路径管理。",
      publicHref: "/projects/agent-training",
      ownerHandle: "dax",
      ownerLabel: "达西",
      categoryLabel: "人工智能",
      stageLabel: "训练回放",
      progressPercent: 36,
      progressLabel: "训练回放与评估板已能展示主链，当前在补全指标聚类与失败重放。",
      rewardShareLabel: "成功结项后 10% 阶段性收益回馈",
      sponsorOpen: true,
      sponsorStatusLabel: "开放赞助",
      joinOpen: false,
      joinStatusLabel: "核心成员制",
      collaborationLabel: "评估指标 / 训练批次 / 回放分析",
      fundingTargetAmount: 10000,
      workspaceHref: "https://github.com/neuroloom-labs/agent-training-dashboard",
      workspaceLabel: "GitHub 工作目录",
      detailBody:
        "智能体训练仪表盘用于把训练批次、失败重放、指标波动和人工接管记录收成一套可以持续迭代的训练视图。当前阶段重点是把实验数据串起来，而不是先做广义平台化发布。",
      sponsorCount: 11,
      sponsoredAmount: 4200,
      sponsoredCurrencyLabel: "MIRA",
    },
    {
      id: "project-demo-4",
      name: "合规模块验证器",
      summary: "对外接口与隐私规则自动巡检。",
      publicHref: "/projects/compliance-check",
      ownerHandle: "mei",
      ownerLabel: "梅时",
      categoryLabel: "网络代理",
      stageLabel: "规则校核",
      progressPercent: 29,
      progressLabel: "当前完成最小规则扫描与告警编排，后续继续接入更完整的策略集。",
      rewardShareLabel: "项目结项后按 6% 回报支持者",
      sponsorOpen: false,
      sponsorStatusLabel: "暂不接收赞助",
      joinOpen: true,
      joinStatusLabel: "接收规则维护者",
      collaborationLabel: "策略模板 / 风险标签 / 审计规则",
      fundingTargetAmount: 8000,
      workspaceHref: "https://github.com/neuroloom-labs/compliance-check",
      workspaceLabel: "GitHub 工作目录",
      detailBody:
        "合规模块验证器面向接口规则、隐私边界与发布前巡检场景。项目目标不是替代完整的安全平台，而是先把最常用的上线前校核、异常告警与策略演练接入账户终端。",
      sponsorCount: 9,
      sponsoredAmount: 3100,
      sponsoredCurrencyLabel: "MIRA",
    },
  ];
}

function buildInvestmentProjectCatalog(): AccountHonorProjectShowcase[] {
  return [
    {
      id: "project-demo-2",
      name: "终端协作工作台",
      summary: "当前回报率 20%，分润周期每月结算。",
      publicHref: "/projects/terminal-collab",
      ownerHandle: "sora",
      ownerLabel: "空川",
      categoryLabel: "网络搜索",
      stageLabel: "协作验证",
      progressPercent: 73,
      progressLabel: "多终端协作与权限同步正在小范围验证，当前在压缩冷启动与同步延迟。",
      rewardShareLabel: "正式商用后 12% 收益分成",
      sponsorOpen: true,
      sponsorStatusLabel: "开放赞助",
      joinOpen: true,
      joinStatusLabel: "接收开发者",
      collaborationLabel: "前端终端壳 / 同步引擎 / 文档编排",
      fundingTargetAmount: 15000,
      workspaceHref: "https://github.com/neuroloom-labs/terminal-collab",
      workspaceLabel: "GitHub 工作目录",
      detailBody:
        "终端协作工作台希望把“轻协作 + 本地优先 + 指令式面板”整合成一个适合小团队的工作区。项目当前已经能跑通账户终端、任务、审计与基础同步，正在补齐更稳定的多人协作体验。",
      sponsorCount: 26,
      sponsoredAmount: 9800,
      sponsoredCurrencyLabel: "MIRA",
    },
    {
      id: "project-demo-5",
      name: "医疗影像标注套件",
      summary: "成功后 10 倍返还，当前处于开发期。",
      publicHref: "/projects/med-annotation",
      ownerHandle: "aurora",
      ownerLabel: "曙岚",
      categoryLabel: "人工智能",
      stageLabel: "模型训练",
      progressPercent: 41,
      progressLabel: "标注流程与训练清单已经确认，当前在封装新一轮模型校验。",
      rewardShareLabel: "结项后 10 倍返还",
      sponsorOpen: true,
      sponsorStatusLabel: "开放赞助",
      joinOpen: true,
      joinStatusLabel: "接收数据协作",
      collaborationLabel: "数据标注 / 临床审核 / 模型回放",
      fundingTargetAmount: 12000,
      workspaceHref: "https://github.com/neuroloom-labs/med-annotation",
      workspaceLabel: "GitHub 工作目录",
      detailBody:
        "医疗影像标注套件聚焦医学影像的标准化标注与模型校验流程，当前在补齐临床专家审核与更细的训练分层。项目强调合规边界与可追溯数据链路。",
      sponsorCount: 13,
      sponsoredAmount: 5200,
      sponsoredCurrencyLabel: "MIRA",
    },
    {
      id: "project-demo-6",
      name: "公共数据整理工坊",
      summary: "收益共享 15%，支持米拉或耀石资助。",
      publicHref: "/projects/data-foundry",
      ownerHandle: "lyra",
      ownerLabel: "澜音",
      categoryLabel: "网络搜索",
      stageLabel: "数据打磨",
      progressPercent: 58,
      progressLabel: "已完成第一批公共数据清洗与标签规范，当前在补齐版本同步。",
      rewardShareLabel: "收益共享 15%",
      sponsorOpen: true,
      sponsorStatusLabel: "开放赞助",
      joinOpen: true,
      joinStatusLabel: "接收贡献者",
      collaborationLabel: "数据清洗 / 标签规范 / 版本同步",
      fundingTargetAmount: 14000,
      workspaceHref: "https://github.com/neuroloom-labs/data-foundry",
      workspaceLabel: "GitHub 工作目录",
      detailBody:
        "公共数据整理工坊用于把分散的公共数据集重新规范化，重点是建立一致的版本记录和标签体系，支持后续数据产品复用。",
      sponsorCount: 21,
      sponsoredAmount: 7600,
      sponsoredCurrencyLabel: "MIRA",
    },
    {
      id: "project-demo-7",
      name: "终端镜像工作流",
      summary: "支持本地镜像构建与任务回放的基础设施组件。",
      publicHref: "/projects/terminal-runtime",
      ownerHandle: "nova",
      ownerLabel: "诺瓦",
      categoryLabel: "网络代理",
      stageLabel: "运行时打磨",
      progressPercent: 34,
      progressLabel: "本地镜像构建已贯通，当前在优化回放与权限隔离链路。",
      rewardShareLabel: "结项后 7% 收益回流支持者",
      sponsorOpen: true,
      sponsorStatusLabel: "开放赞助",
      joinOpen: true,
      joinStatusLabel: "接收平台协作",
      collaborationLabel: "运行时 / 回放 / 权限隔离",
      fundingTargetAmount: 9000,
      workspaceHref: "https://github.com/neuroloom-labs/terminal-runtime",
      workspaceLabel: "GitHub 工作目录",
      detailBody:
        "终端镜像工作流负责为终端协作类项目提供稳定的本地镜像与回放路径，当前重点是压缩权限隔离成本。",
      sponsorCount: 8,
      sponsoredAmount: 2600,
      sponsoredCurrencyLabel: "MIRA",
    },
  ];
}

function buildDemoIssueCatalog(): AccountHonorIssueShowcase[] {
  return [
    {
      id: "issue-demo-1",
      name: "圣诞节终端风格",
      summary: "社区提案：若支持率与票数都进入榜首阈值，则官方开始实现冬季主题界面。",
      publicHref: "/opinions/christmas-terminal",
      supporterCount: 86,
      supportedAmount: 1680,
      supportedCurrencyLabel: "投票券",
      supportRate: 78,
      statusLabel: "票选领先",
    },
    {
      id: "issue-demo-2",
      name: "移动端终端导航重构",
      summary: "社区提案：压缩顶部入口并重排底部磁贴，当前仍处于拉票阶段。",
      publicHref: "/opinions/mobile-terminal-nav",
      supporterCount: 72,
      supportedAmount: 1320,
      supportedCurrencyLabel: "投票券",
      supportRate: 71,
      statusLabel: "讨论中",
    },
    {
      id: "issue-demo-3",
      name: "创作素材云同步",
      summary: "社区提案：将素材清单与版本记录接入统一同步台，当前等待更多支持票。",
      publicHref: "/opinions/asset-sync",
      supporterCount: 64,
      supportedAmount: 980,
      supportedCurrencyLabel: "投票券",
      supportRate: 67,
      statusLabel: "等待冲榜",
    },
    {
      id: "issue-demo-4",
      name: "智能体协作时间线",
      summary: "社区提案：为多智能体任务提供共享时间线视图，达到票数门槛后进入实现排期。",
      publicHref: "/opinions/agent-timeline",
      supporterCount: 58,
      supportedAmount: 840,
      supportedCurrencyLabel: "投票券",
      supportRate: 61,
      statusLabel: "待补票",
    },
  ];
}

function buildDemoInvestmentIssueCatalog(): AccountHonorIssueShowcase[] {
  return [
    {
      id: "issue-demo-1",
      name: "圣诞节终端风格",
      summary: "你已投票支持这项冬季主题提案，若议题冲到榜首且票数达标，官方会开始实现。",
      publicHref: "/opinions/christmas-terminal",
      supporterCount: 86,
      supportedAmount: 520,
      supportedCurrencyLabel: "投票券",
      supportRate: 78,
      statusLabel: "已支持",
    },
    {
      id: "issue-demo-2",
      name: "移动端终端导航重构",
      summary: "你已投票支持移动端导航重排提案，当前还在社区拉票阶段。",
      publicHref: "/opinions/mobile-terminal-nav",
      supporterCount: 72,
      supportedAmount: 360,
      supportedCurrencyLabel: "投票券",
      supportRate: 71,
      statusLabel: "已支持",
    },
    {
      id: "issue-demo-3",
      name: "创作素材云同步",
      summary: "你已为素材云同步提案投入支持票，等待进入更高支持档位。",
      publicHref: "/opinions/asset-sync",
      supporterCount: 64,
      supportedAmount: 280,
      supportedCurrencyLabel: "投票券",
      supportRate: 67,
      statusLabel: "已支持",
    },
    {
      id: "issue-demo-4",
      name: "智能体协作时间线",
      summary: "你已支持智能体协作时间线提案，若票数继续上涨将进入实现候选。",
      publicHref: "/opinions/agent-timeline",
      supporterCount: 58,
      supportedAmount: 180,
      supportedCurrencyLabel: "投票券",
      supportRate: 61,
      statusLabel: "已支持",
    },
  ];
}

function getIssuePublicHref(topicId: string) {
  return `${ISSUE_PUBLIC_PATH}?topicId=${encodeURIComponent(topicId)}`;
}

function buildIssueStatusLabel(topic: OpinionTopicView) {
  if (topic.adoptedAt) {
    return "已采纳";
  }
  if (topic.status === "qualified") {
    return "已达标";
  }
  if (topic.status === "archived") {
    return "已归档";
  }
  return "拉票中";
}

function buildIssueShowcaseFromTopic(topic: OpinionTopicView, supportedAmount: number): AccountHonorIssueShowcase {
  return {
    id: topic.id,
    name: topic.title,
    summary: topic.summary,
    publicHref: getIssuePublicHref(topic.id),
    supporterCount: topic.uniqueSupporterCount,
    supportedAmount,
    supportedCurrencyLabel: ISSUE_CURRENCY_LABEL,
    supportRate: clampPercent(topic.supportRate * 100),
    statusLabel: buildIssueStatusLabel(topic),
  };
}

function buildIssueCatalogFromTopics(topics: OpinionTopicView[], limit = 8) {
  return topics.slice(0, limit).map((topic) => buildIssueShowcaseFromTopic(topic, topic.supportTicketTotal));
}

function buildInvestmentIssueCatalogFromSupports(
  topics: OpinionTopicView[],
  supportSummaries: OpinionTopicSupportSummaryView[],
) {
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
  return supportSummaries
    .map((summary) => {
      const topic = topicMap.get(summary.topicId);
      if (!topic || summary.ticketAmount <= 0) {
        return null;
      }
      return buildIssueShowcaseFromTopic(topic, summary.ticketAmount);
    })
    .filter((issue): issue is AccountHonorIssueShowcase => Boolean(issue))
    .sort((a, b) => b.supportedAmount - a.supportedAmount);
}

function buildSponsorshipSummary(
  investmentProjectCatalog: AccountHonorProjectShowcase[],
  showcasedInvestmentProjectIds: string[] | null | undefined,
): AccountHonorSponsorshipSummary {
  const sponsoredProjects = selectProjectShowcase(investmentProjectCatalog, showcasedInvestmentProjectIds, 3);
  const currencyLabel = sponsoredProjects[0]?.sponsoredCurrencyLabel ?? investmentProjectCatalog[0]?.sponsoredCurrencyLabel ?? "MIRA";

  return {
    sponsoredCount: sponsoredProjects.length,
    totalAmount: sponsoredProjects.reduce((sum, project) => sum + project.sponsoredAmount, 0),
    currencyLabel,
    sponsoredProjects,
  };
}

function selectIssueShowcase(
  catalog: AccountHonorIssueShowcase[],
  showcasedIssueIds: string[] | null | undefined,
  limit = 4,
) {
  const fallback = catalog.slice(0, limit);
  if (!showcasedIssueIds || showcasedIssueIds.length === 0) {
    return fallback;
  }

  const catalogById = new Map(catalog.map((issue) => [issue.id, issue] as const));
  return showcasedIssueIds
    .map((issueId) => catalogById.get(issueId) ?? null)
    .filter((issue): issue is AccountHonorIssueShowcase => Boolean(issue))
    .slice(0, limit);
}

function buildIssueSupportSummary(
  investmentIssueCatalog: AccountHonorIssueShowcase[],
  showcasedInvestmentIssueIds: string[] | null | undefined,
): AccountHonorIssueSupportSummary {
  const supportedIssues = selectIssueShowcase(investmentIssueCatalog, showcasedInvestmentIssueIds, 3);
  const currencyLabel = supportedIssues[0]?.supportedCurrencyLabel ?? investmentIssueCatalog[0]?.supportedCurrencyLabel ?? "投票券";

  return {
    supportedCount: supportedIssues.length,
    totalAmount: supportedIssues.reduce((sum, issue) => sum + issue.supportedAmount, 0),
    currencyLabel,
    supportedIssues,
  };
}

function buildHonorActivityHeatmap(args: {
  user: {
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string;
  };
  reputation: {
    updatedAt: string;
  } | null;
  agents: Array<{
    createdAt: string;
    updatedAt: string;
  }>;
  items: Array<{
    createdAt: string;
  }>;
  tasks: Array<{
    createdAt: string;
  }>;
  arbitrations: Array<{
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
  }>;
}): AccountHonorActivityHeatmap {
  const buckets = new Map<string, ActivityBucket>();

  pushActivitySignal(buckets, args.user.createdAt, 3, "加入平台");
  pushActivitySignal(buckets, args.user.lastLoginAt, 1, "登录终端");
  pushActivitySignal(buckets, args.user.updatedAt, 1, "档案同步");

  if (args.reputation) {
    pushActivitySignal(buckets, args.reputation.updatedAt, 1, "信誉刷新");
  }

  for (const agent of args.agents) {
    pushActivitySignal(buckets, agent.createdAt, 3, "登记智能体");
    if (toDateKey(agent.updatedAt) !== toDateKey(agent.createdAt)) {
      pushActivitySignal(buckets, agent.updatedAt, 1, "智能体更新");
    }
  }

  for (const item of args.items) {
    pushActivitySignal(buckets, item.createdAt, 3, "资产获取");
  }

  for (const task of args.tasks) {
    pushActivitySignal(buckets, task.createdAt, 2, "任务参与");
  }

  for (const arbitration of args.arbitrations) {
    pushActivitySignal(buckets, arbitration.createdAt, 2, "仲裁事件");
    if (toDateKey(arbitration.updatedAt) !== toDateKey(arbitration.createdAt)) {
      pushActivitySignal(buckets, arbitration.updatedAt, 1, "仲裁推进");
    }
    if (arbitration.resolvedAt && toDateKey(arbitration.resolvedAt) !== toDateKey(arbitration.updatedAt)) {
      pushActivitySignal(buckets, arbitration.resolvedAt, 1, "仲裁结案");
    }
  }

  const endDate = startOfDay(new Date());
  const endWeekStart = startOfWeekMonday(endDate);
  const startDate = addDays(endWeekStart, -(HONOR_ACTIVITY_WEEK_COUNT - 1) * 7);

  let maxCount = 0;
  let totalSignals = 0;
  let activeDayCount = 0;
  let lastActiveDate: Date | null = null;

  for (const [dateKey, bucket] of buckets.entries()) {
    const date = parseDateKey(dateKey);
    if (date < startDate || date > endDate) {
      continue;
    }

    totalSignals += bucket.count;
    activeDayCount += 1;
    maxCount = Math.max(maxCount, bucket.count);
    if (!lastActiveDate || date > lastActiveDate) {
      lastActiveDate = date;
    }
  }

  const weeks: AccountHonorActivityWeek[] = [];
  const months: AccountHonorActivityMonthMarker[] = [];
  const monthKeys = new Set<string>();

  for (let weekIndex = 0; weekIndex < HONOR_ACTIVITY_WEEK_COUNT; weekIndex += 1) {
    const weekStart = addDays(startDate, weekIndex * 7);
    const days = [];

    for (let weekday = 0; weekday < 7; weekday += 1) {
      const currentDate = addDays(weekStart, weekday);
      const dateKey = formatDateKey(currentDate);
      const future = currentDate > endDate;
      const bucket = future ? null : (buckets.get(dateKey) ?? null);
      const level = buildActivityLevel(bucket?.count ?? 0, maxCount, future);

      days.push({
        date: dateKey,
        count: future ? 0 : (bucket?.count ?? 0),
        future,
        level,
        title: buildActivityTitle({
          date: currentDate,
          bucket,
          future,
        }),
      });

      if (weekday === 0) {
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
        if (!monthKeys.has(monthKey) && (weekIndex === 0 || currentDate.getDate() <= 7)) {
          monthKeys.add(monthKey);
          months.push({
            key: monthKey,
            label: formatMonthShort(currentDate),
            weekIndex,
          });
        }
      }
    }

    weeks.push({
      key: formatDateKey(weekStart),
      days,
    });
  }

  return {
    weeks,
    months,
    totalSignals,
    activeDayCount,
    maxCount,
    rangeLabel: `${formatMonthDay(startDate)} - ${formatMonthDay(endDate)}`,
    lastActiveLabel: lastActiveDate ? formatFullDate(lastActiveDate) : null,
  };
}

export async function handleAccountHonorPanelRequest(request: Request) {
  try {
    const userContext = await requirePlatformUserContext();
    const [features, user] = await Promise.all([
      getFeatureSnapshot(),
      getCurrentUser(userContext),
    ]);

    if (!user) {
      return withNoCacheJson(
        { error: "user_not_found" },
        {
          status: 404,
        },
      );
    }

    const [reputation, items, agents, executions, tasks, arbitrations] = await Promise.all([
      features.reputation.enabled
        ? withFallback(getReputationSummary(userContext), null)
        : Promise.resolve(null),
      features.item.enabled && features.product.enabled
        ? withFallback(listItems(userContext), [])
        : Promise.resolve([]),
      features.agentRegistry.enabled
        ? withFallback(listAgents(userContext), [] as Awaited<ReturnType<typeof listAgents>>)
        : Promise.resolve([] as Awaited<ReturnType<typeof listAgents>>),
      features.agentRegistry.enabled
        ? withFallback(listAgentExecutions(userContext), [] as Awaited<ReturnType<typeof listAgentExecutions>>)
        : Promise.resolve([] as Awaited<ReturnType<typeof listAgentExecutions>>),
      features.taskHub.enabled
        ? withFallback(listMyTasks(userContext), [] as Awaited<ReturnType<typeof listMyTasks>>)
        : Promise.resolve([] as Awaited<ReturnType<typeof listMyTasks>>),
      features.arbitration.enabled
        ? withFallback(
            listArbitrationCases(userContext),
            [] as Awaited<ReturnType<typeof listArbitrationCases>>,
          )
        : Promise.resolve([] as Awaited<ReturnType<typeof listArbitrationCases>>),
    ]);

    const opinionHubEnabled = features.opinionHub.enabled;
      const [projectPanel, opinionTopics, opinionSupportSummaries] = await Promise.all([
        withFallback(getHonorProjectPanel(userContext), {
          projectCatalog: buildProjectCatalog(),
          investmentProjectCatalog: buildInvestmentProjectCatalog(),
          memberships: [],
        }),
      opinionHubEnabled ? withFallback(listOpinionTopics(userContext), [] as OpinionTopicView[]) : Promise.resolve([]),
      opinionHubEnabled
        ? withFallback(
            listOpinionTopicSupportSummaries(userContext),
            [] as OpinionTopicSupportSummaryView[],
          )
        : Promise.resolve([] as OpinionTopicSupportSummaryView[]),
    ]);

    const accountDisplayName = user.username || userContext.username || "未知";
    const accountAvatarUrl = user.avatarUrl || null;
    const profileTagline = user.profileTagline || null;
    const providerUserId = user.providerUserId || userContext.providerUserId || "未知";
    const joinedAtLabel = user.createdAt
      ? new Date(user.createdAt).toLocaleDateString("zh-CN")
      : "未知";
    const trustLevel = user.trustLevel ?? null;
    const progression = user.snapshot?.progression ?? null;
    const assetSnapshot = user.snapshot?.assets ?? null;
    const agentSnapshot = user.snapshot?.agents ?? null;
    const totalAssetCount = assetSnapshot?.activeItems ?? assetSnapshot?.totalItems ?? 0;
    const listedAssetCount = assetSnapshot?.listedItems ?? items.filter((item) => item.status === "listed").length;
    const enabledAgentCount = agentSnapshot?.enabledAgents ?? 0;
    const agentCapabilityCount = agentSnapshot?.capabilityCount ?? 0;
    const taskActiveCount = tasks.filter((task) =>
      ["open", "applying", "assigned", "in_progress", "submitted"].includes(task.status),
    ).length;
    const arbitrationOpenCount = arbitrations.filter((caseView) =>
      ["open", "under_review"].includes(caseView.status),
    ).length;
    const unlockedAccessCount = progression?.access.filter((rule) => rule.satisfied).length ?? 0;
    const nextLevelLabel = progression?.nextLevelPreview
      ? `Lv.${progression.nextLevelPreview.level} ${progression.nextLevelPreview.title}`
      : "已达到当前最高等级";

    const { agentCatalog, agentShowcase } = buildAgentShowcase({
      agents,
      executions,
      tasks,
      arbitrations,
      showcasedAgentIds: user.honorShowcasedAgentIds,
      includeDefaultFixture: isLocalPreviewRequest(request),
    });
    const effectiveEnabledAgentCount = Math.max(
      enabledAgentCount,
      agentCatalog.filter((agent) => agent.enabled).length,
    );
    const effectiveAgentCapabilityCount = Math.max(agentCapabilityCount, agentCatalog.length);

    const abilityMetrics = buildHonorAbilityMetrics({
      progression,
      reputation,
      trustLevel,
      enabledAgentCount: effectiveEnabledAgentCount,
      agentCapabilityCount: effectiveAgentCapabilityCount,
      totalAssetCount,
      listedAssetCount,
      unlockedAccessCount,
      benefitCount: progression?.benefits.length ?? 0,
      taskActiveCount,
    });
    const projectCatalog = projectPanel.projectCatalog;
    const projectShowcase = selectProjectShowcase(projectCatalog, user.honorShowcasedProjectIds);
    const investmentProjectCatalog = projectPanel.investmentProjectCatalog;
    const sponsorshipSummary = buildSponsorshipSummary(
      investmentProjectCatalog,
      user.honorShowcasedInvestmentProjectIds,
    );
    const hasOpinionData = opinionHubEnabled && opinionTopics.length > 0;
    const issueCatalog = hasOpinionData ? buildIssueCatalogFromTopics(opinionTopics) : buildDemoIssueCatalog();
    const issueShowcase = selectIssueShowcase(issueCatalog, user.honorShowcasedIssueIds);
    const investmentIssueCatalog = hasOpinionData
      ? buildInvestmentIssueCatalogFromSupports(opinionTopics, opinionSupportSummaries)
      : buildDemoInvestmentIssueCatalog();
    const issueSupportSummary = buildIssueSupportSummary(
      investmentIssueCatalog,
      user.honorShowcasedInvestmentIssueIds,
    );
    const taskPerformance = buildTaskPerformance({
      reputation,
      tasks,
      userId: user.id,
    });
    const activityHeatmap = buildHonorActivityHeatmap({
      user: {
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
      reputation,
      agents,
      items,
      tasks,
      arbitrations,
    });

    const panel: AccountHonorCenterProps = {
      accountAvatarUrl,
      accountDisplayName,
      profileTagline,
      abilityMetrics,
      activityHeatmap,
      agentCatalog,
      agentShowcase,
      projectCatalog,
      projectShowcase,
      investmentProjectCatalog,
      sponsorshipSummary,
      issueCatalog,
      issueShowcase,
      investmentIssueCatalog,
      issueSupportSummary,
      arbitrationOpenCount,
      enabledAgentCount: effectiveEnabledAgentCount,
      joinedAtLabel,
      listedAssetCount,
      nextLevelLabel,
      progression,
      providerUserId,
      reputation,
      taskPerformance,
      taskActiveCount,
      totalAssetCount,
      trustLevel,
      unlockedAccessCount,
    };

    return withNoCacheJson({
      panel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "荣誉面板暂不可用";
    return withNoCacheJson(
      { error: message },
      {
        status: resolveHonorAuthAwareStatus(message, 503),
      },
    );
  }
}


const updateProfileSchema = z.object({
  profileTagline: z.string().trim().max(80).nullable().optional(),
  honorShowcasedAgentIds: z.array(z.string().trim().min(1)).max(4).nullable().optional(),
  honorShowcasedProjectIds: z.array(z.string().trim().min(1)).max(4).nullable().optional(),
  honorShowcasedInvestmentProjectIds: z.array(z.string().trim().min(1)).max(3).nullable().optional(),
  honorShowcasedIssueIds: z.array(z.string().trim().min(1)).max(4).nullable().optional(),
  honorShowcasedInvestmentIssueIds: z.array(z.string().trim().min(1)).max(3).nullable().optional(),
});

export async function handleAccountHonorProfileRequest(request: Request) {
  try {
    const userContext = await requirePlatformUserContext();
    const payload = updateProfileSchema.parse(await request.json());
    const user = await updateCurrentUserProfile(userContext, payload);

    return withNoCacheJson({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile update failed";
    return withNoCacheJson(
      { error: message },
      {
        status: resolveHonorAuthAwareStatus(message, 400),
      },
    );
  }
}
