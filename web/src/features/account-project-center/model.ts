import type {
  HonorProjectMembershipStatus,
  HonorProjectPanelView,
  HonorProjectShowcaseView,
  UserSummary,
} from "@neuro/contracts";

import {
  combineDependencyResults,
  createDependencyFailureResult,
  createDependencyResult,
  type DependencyResult,
  type DependencyFailureInput,
} from "@/lib/dependency-result";

export const PROJECT_PANEL_UNAVAILABLE_MESSAGE = "项目面板暂时不可用。";

export const PROJECT_SCOPE_OPTIONS = [
  { key: "mine", label: "我的项目" },
  { key: "hot", label: "热门项目" },
  { key: "person", label: "某人项目" },
] as const;

export type ProjectCenterScope = (typeof PROJECT_SCOPE_OPTIONS)[number]["key"];

export type ProjectCenterQueryParams = {
  message?: string;
  owner?: string;
  project?: string;
  scope?: string;
  status?: string;
};

export type ProjectMilestoneView = {
  key: string;
  label: string;
  note: string;
  status: "done" | "active" | "planned";
};

export type ProjectPresentationProfile = {
  categoryLabel: string;
  collaborationLabel: string;
  detailBody: string;
  fundingTargetAmount: number;
  joinOpen: boolean;
  joinStatusLabel: string;
  milestoneItems: ProjectMilestoneView[];
  ownerAliases?: string[];
  ownerHandle: string;
  ownerLabel: string;
  progressLabel: string;
  progressPercent: number;
  rewardShareLabel: string;
  sponsorOpen: boolean;
  sponsorStatusLabel: string;
  stageLabel: string;
  workspaceHref: string;
  workspaceLabel: string;
};

export type ProjectOwnerDirectoryEntry = {
  handle: string;
  label: string;
};

export type ProjectCardView = HonorProjectShowcaseView & {
  categoryLabel: string;
  collaborationLabel: string;
  detailBody: string;
  fundingTargetAmount: number;
  fundingTargetCurrencyLabel: string;
  isOwnedByCurrentUser: boolean;
  isUserBackedProject: boolean;
  joinOpen: boolean;
  joinStatusLabel: string;
  membershipRoleLabel: string | null;
  membershipStatus: "none" | HonorProjectMembershipStatus;
  milestoneItems: ProjectMilestoneView[];
  ownerHandle: string;
  ownerLabel: string;
  personalSponsoredAmount: number;
  progressLabel: string;
  progressPercent: number;
  rewardShareLabel: string;
  sponsorOpen: boolean;
  sponsorStatusLabel: string;
  stageLabel: string;
  workspaceHref: string;
  workspaceLabel: string;
};

export type ProjectCenterPanelView = {
  currentUser: UserSummary | null;
  dependency: DependencyResult<ProjectCenterDependencyData>;
  hotProjects: ProjectCardView[];
  myProjects: ProjectCardView[];
  ownerDirectory: ProjectOwnerDirectoryEntry[];
};

export type ProjectCenterDependencyData = {
  currentUser: UserSummary | null;
  projectPanel: HonorProjectPanelView;
};

export type ProjectCenterDependencyInputs = {
  currentUser: DependencyResult<UserSummary | null>;
  projectPanel: DependencyResult<HonorProjectPanelView>;
};

export function createProjectDependencyFailure<T>(args: {
  error: unknown;
  message: string;
  source: string;
  unauthorizedMessage?: string;
}): DependencyResult<T> {
  return createDependencyFailureResult({
    error: args.error,
    message: args.message,
    source: args.source,
    unauthorizedMessage: args.unauthorizedMessage,
  });
}

export const EMPTY_HONOR_PROJECT_PANEL: HonorProjectPanelView = {
  investmentProjectCatalog: [],
  memberships: [],
  projectCatalog: [],
};

function hasProjectData(panel: HonorProjectPanelView) {
  return panel.projectCatalog.length > 0 || panel.investmentProjectCatalog.length > 0 || panel.memberships.length > 0;
}

export function combineProjectCenterDependencies(
  inputs: ProjectCenterDependencyInputs,
): DependencyResult<ProjectCenterDependencyData> {
  if (
    inputs.projectPanel.state === "unavailable" ||
    inputs.projectPanel.state === "unauthorized"
  ) {
    const secondaryFailures = inputs.currentUser.failures;
    if (secondaryFailures.length === 0) {
      return inputs.projectPanel;
    }
    const failures = [
      ...inputs.projectPanel.failures,
      ...secondaryFailures,
    ] as [DependencyFailureInput, ...DependencyFailureInput[]];
    const base = {
      correlationId: inputs.projectPanel.correlationId ?? inputs.currentUser.correlationId,
      failures,
      retry: inputs.projectPanel.retry,
    };
    return inputs.projectPanel.state === "unavailable"
      ? createDependencyResult<ProjectCenterDependencyData>({ state: "unavailable", ...base })
      : createDependencyResult<ProjectCenterDependencyData>({ state: "unauthorized", ...base });
  }

  const currentUser =
    inputs.currentUser.state === "ready" || inputs.currentUser.state === "partial"
      ? inputs.currentUser.data
      : null;
  const projectPanel =
    inputs.projectPanel.state === "ready" || inputs.projectPanel.state === "partial"
      ? inputs.projectPanel.data
      : EMPTY_HONOR_PROJECT_PANEL;
  return combineDependencyResults({
    data: { currentUser, projectPanel },
    empty: !hasProjectData(projectPanel),
    results: [inputs.currentUser, inputs.projectPanel],
  });
}

export const PROJECT_PRESENTATION_LIBRARY: Record<string, ProjectPresentationProfile> = {
  "paper-polish": {
    ownerHandle: "zhiwei",
    ownerLabel: "知微",
    ownerAliases: ["论文组", "paper"],
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
    milestoneItems: [
      { key: "polish-m1", label: "排版骨架", note: "LaTeX / Markdown 双轨模板已打通。", status: "done" },
      { key: "polish-m2", label: "图表增强", note: "图表重绘与注释建议正在联调。", status: "active" },
      { key: "polish-m3", label: "投稿助手", note: "后续接入期刊模板与审稿清单。", status: "planned" },
    ],
  },
  "terminal-collab": {
    ownerHandle: "sora",
    ownerLabel: "空川",
    ownerAliases: ["terminal", "collab"],
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
    milestoneItems: [
      { key: "collab-m1", label: "终端壳层", note: "账户终端与权限外壳已稳定。", status: "done" },
      { key: "collab-m2", label: "多端同步", note: "同步冲突回放与协作锁机制正在小范围验证。", status: "active" },
      { key: "collab-m3", label: "共享工位", note: "后续引入外部目录与共享工作台。", status: "planned" },
    ],
  },
  "agent-training": {
    ownerHandle: "dax",
    ownerLabel: "达西",
    ownerAliases: ["agent", "train"],
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
    milestoneItems: [
      { key: "agent-m1", label: "批次看板", note: "实验批次和回放目录已接通。", status: "done" },
      { key: "agent-m2", label: "指标聚类", note: "当前在补充失败类目与趋势判断。", status: "active" },
      { key: "agent-m3", label: "收益对账", note: "后续接入结算和分润审计。", status: "planned" },
    ],
  },
  "compliance-check": {
    ownerHandle: "mei",
    ownerLabel: "梅时",
    ownerAliases: ["compliance", "check"],
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
    milestoneItems: [
      { key: "compliance-m1", label: "最小规则集", note: "上线前巡检规则已能运行。", status: "done" },
      { key: "compliance-m2", label: "风险标注", note: "当前在完善标签与告警分级。", status: "active" },
      { key: "compliance-m3", label: "策略回放", note: "后续增加规则变更对比与回放。", status: "planned" },
    ],
  },
};
