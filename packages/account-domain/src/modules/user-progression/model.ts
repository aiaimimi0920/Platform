import type {
  UserProgressionAccessKey,
  UserProgressionAccessRule,
  UserProgressionBenefit,
  UserProgressionExperienceSource,
  UserProgressionSnapshot,
} from "@neuro/contracts";

export type UserProgressionMetricValues = {
  dailyRewardCount: number;
  dailyMissionCount: number;
  weeklyMissionCount: number;
  taskApplicationCount: number;
  taskCreatedCount: number;
  taskCompletedCount: number;
  itemOwnedCount: number;
  opinionCreatedCount: number;
  opinionParticipationCount: number;
  agentCreatedCount: number;
  agentCapabilityCount: number;
};

type ProgressionSourceDefinition = {
  key: UserProgressionExperienceSource["key"];
  label: string;
  experiencePerUnit: number;
  metricValue: (args: { trustLevel: number | null; metrics: UserProgressionMetricValues }) => number;
};

type ProgressionLevelDefinition = {
  level: number;
  title: string;
  minExperience: number;
  rewardDiscountRate: number;
  benefits: UserProgressionBenefit[];
};

type ProgressionAccessDefinition = {
  key: UserProgressionAccessKey;
  title: string;
  minLevel: number;
  note: (args: { minLevel: number; minLevelTitle: string }) => string;
};

const progressionSourceDefinitions: ProgressionSourceDefinition[] = [
  {
    key: "registration",
    label: "账号注册",
    experiencePerUnit: 40,
    metricValue: () => 1,
  },
  {
    key: "trustLevel",
    label: "社区信任等级",
    experiencePerUnit: 18,
    metricValue: ({ trustLevel }) => Math.max(0, trustLevel ?? 0),
  },
  {
    key: "dailyReward",
    label: "每日签到",
    experiencePerUnit: 8,
    metricValue: ({ metrics }) => metrics.dailyRewardCount,
  },
  {
    key: "dailyMission",
    label: "日常任务领取",
    experiencePerUnit: 10,
    metricValue: ({ metrics }) => metrics.dailyMissionCount,
  },
  {
    key: "weeklyMission",
    label: "周常任务领取",
    experiencePerUnit: 24,
    metricValue: ({ metrics }) => metrics.weeklyMissionCount,
  },
  {
    key: "taskApplication",
    label: "任务申请",
    experiencePerUnit: 18,
    metricValue: ({ metrics }) => metrics.taskApplicationCount,
  },
  {
    key: "taskCreated",
    label: "发布任务",
    experiencePerUnit: 20,
    metricValue: ({ metrics }) => metrics.taskCreatedCount,
  },
  {
    key: "taskCompleted",
    label: "任务完成",
    experiencePerUnit: 60,
    metricValue: ({ metrics }) => metrics.taskCompletedCount,
  },
  {
    key: "itemOwned",
    label: "资产获取",
    experiencePerUnit: 24,
    metricValue: ({ metrics }) => metrics.itemOwnedCount,
  },
  {
    key: "opinionCreated",
    label: "发起议题",
    experiencePerUnit: 20,
    metricValue: ({ metrics }) => metrics.opinionCreatedCount,
  },
  {
    key: "opinionParticipated",
    label: "议题参与",
    experiencePerUnit: 10,
    metricValue: ({ metrics }) => metrics.opinionParticipationCount,
  },
  {
    key: "agentCreated",
    label: "登记 Agent",
    experiencePerUnit: 28,
    metricValue: ({ metrics }) => metrics.agentCreatedCount,
  },
  {
    key: "agentCapability",
    label: "登记能力",
    experiencePerUnit: 8,
    metricValue: ({ metrics }) => metrics.agentCapabilityCount,
  },
];

const progressionLevels: ProgressionLevelDefinition[] = [
  {
    level: 1,
    title: "新用户",
    minExperience: 0,
    rewardDiscountRate: 0,
    benefits: [
      {
        key: "base-console",
        kind: "access",
        title: "基础控制台",
        description: "可访问账户、钱包、签到、资产与治理的基础入口。",
      },
    ],
  },
  {
    level: 2,
    title: "活跃用户",
    minExperience: 120,
    rewardDiscountRate: 0,
    benefits: [
      {
        key: "starter-qualification",
        kind: "qualification",
        title: "基础资格池",
        description: "后续可将 2 级作为部分活动资格、定向限购与试运行入口的默认起点。",
      },
    ],
  },
  {
    level: 3,
    title: "协作者",
    minExperience: 320,
    rewardDiscountRate: 0,
    benefits: [
      {
        key: "collab-qualification",
        kind: "qualification",
        title: "协作资格层",
        description: "后续可将 3 级作为部分高价值任务、商品与活动入口的默认门槛。",
      },
    ],
  },
  {
    level: 4,
    title: "共建者",
    minExperience: 640,
    rewardDiscountRate: 0,
    benefits: [
      {
        key: "advanced-access",
        kind: "access",
        title: "高级入口预留",
        description: "后续可将 4 级作为更高阶 Agent 能力、供给池与灰度能力的优先开放门槛。",
      },
    ],
  },
  {
    level: 5,
    title: "核心伙伴",
    minExperience: 1040,
    rewardDiscountRate: 0,
    benefits: [
      {
        key: "governance-priority",
        kind: "governance",
        title: "治理与活动优先层",
        description: "后续运营活动、共建计划与治理试点可优先向 5 级以上用户开放。",
      },
    ],
  },
  {
    level: 6,
    title: "平台节点",
    minExperience: 1560,
    rewardDiscountRate: 0,
    benefits: [
      {
        key: "node-access",
        kind: "access",
        title: "核心节点预留",
        description: "后续高阶内测、运营协作与平台节点类能力可优先向 6 级开放。",
      },
    ],
  },
];

const progressionAccessDefinitions: ProgressionAccessDefinition[] = [
  {
    key: "createOpinionTopic",
    title: "发起议题",
    minLevel: 2,
    note: ({ minLevel, minLevelTitle }) =>
      `发起议题至少需要 Lv.${minLevel} ${minLevelTitle}，用于避免治理入口完全无门槛开放。`,
  },
  {
    key: "createPlatformAgent",
    title: "创建平台 Agent",
    minLevel: 2,
    note: ({ minLevel, minLevelTitle }) =>
      `创建平台 Agent 至少需要 Lv.${minLevel} ${minLevelTitle}，确保基础参与度已经建立。`,
  },
  {
    key: "createExternalAgent",
    title: "创建外部 Agent",
    minLevel: 3,
    note: ({ minLevel, minLevelTitle }) =>
      `创建外部 Agent 至少需要 Lv.${minLevel} ${minLevelTitle}，因为它涉及更高的运行与回调管理复杂度。`,
  },
];

function toPercentageLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function toLevelLabel(snapshot: Pick<UserProgressionSnapshot, "level" | "title">): string {
  return `Lv.${snapshot.level} ${snapshot.title}`;
}

function getLevelDefinition(level: number) {
  return progressionLevels.find((item) => item.level === level) ?? progressionLevels[0];
}

export function getUserProgressionAccessRule(
  snapshot: Pick<UserProgressionSnapshot, "level" | "title">,
  key: UserProgressionAccessKey,
): UserProgressionAccessRule {
  const definition = progressionAccessDefinitions.find((item) => item.key === key);
  if (!definition) {
    throw new Error(`Unknown user progression access key: ${key}`);
  }
  const minLevelDefinition = getLevelDefinition(definition.minLevel);
  return {
    key: definition.key,
    title: definition.title,
    minLevel: definition.minLevel,
    minLevelTitle: minLevelDefinition.title,
    satisfied: snapshot.level >= definition.minLevel,
    note: definition.note({
      minLevel: definition.minLevel,
      minLevelTitle: minLevelDefinition.title,
    }),
  };
}

function buildUserProgressionAccessRules(
  snapshot: Pick<UserProgressionSnapshot, "level" | "title">,
): UserProgressionAccessRule[] {
  return progressionAccessDefinitions.map((definition) => getUserProgressionAccessRule(snapshot, definition.key));
}

export function buildUserProgressionSnapshot(args: {
  trustLevel: number | null;
  metrics: UserProgressionMetricValues;
}): UserProgressionSnapshot {
  const sources = progressionSourceDefinitions
    .map((definition) => {
      const metricValue = definition.metricValue(args);
      const experience = Math.max(0, metricValue * definition.experiencePerUnit);
      return {
        key: definition.key,
        label: definition.label,
        experience,
        metricValue,
      } satisfies UserProgressionExperienceSource;
    })
    .filter((source) => source.experience > 0);

  const experience = sources.reduce((sum, source) => sum + source.experience, 0);
  const currentLevel =
    [...progressionLevels].reverse().find((level) => experience >= level.minExperience) ?? progressionLevels[0];
  const nextLevel = progressionLevels.find((level) => level.level === currentLevel.level + 1) ?? null;
  const progressRate = nextLevel
    ? Math.min(
        1,
        Math.max(
          0,
          (experience - currentLevel.minExperience) / Math.max(1, nextLevel.minExperience - currentLevel.minExperience),
        ),
      )
    : 1;

  return {
    level: currentLevel.level,
    title: currentLevel.title,
    experience,
    currentLevelMinExperience: currentLevel.minExperience,
    nextLevelExperience: nextLevel?.minExperience ?? null,
    experienceToNextLevel: nextLevel ? Math.max(0, nextLevel.minExperience - experience) : null,
    progressRate,
    rewardDiscountRate: currentLevel.rewardDiscountRate,
    benefits: currentLevel.benefits,
    access: buildUserProgressionAccessRules({
      level: currentLevel.level,
      title: currentLevel.title,
    }),
    nextLevelPreview: nextLevel
      ? {
          level: nextLevel.level,
          title: nextLevel.title,
          minExperience: nextLevel.minExperience,
          rewardDiscountRate: nextLevel.rewardDiscountRate,
          benefits: nextLevel.benefits,
        }
      : null,
    sources,
  };
}
