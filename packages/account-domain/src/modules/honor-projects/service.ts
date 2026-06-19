import type {
  HonorProjectCatalogView,
  HonorProjectInvestmentView,
  HonorProjectMembershipStatus,
  HonorProjectMembershipView,
  HonorProjectPanelView,
  HonorProjectShowcaseView,
  HonorProjectStatus,
  HonorProjectView,
  JoinHonorProjectInput,
  SponsorHonorProjectInput,
  UpsertHonorProjectInput,
  UpsertHonorProjectInvestmentInput,
} from "@neuro/contracts";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/modules/identity/schema";
import { deductBalance } from "@/modules/wallet-ledger/service";
import { BadRequestError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { honorProjectInvestments, honorProjectMemberships, honorProjects } from "./schema";

const DEFAULT_CURRENCY_LABEL = "MIRA";

const bootstrapHonorProjects: UpsertHonorProjectInput[] = [
  {
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
    sponsoredCurrencyLabel: DEFAULT_CURRENCY_LABEL,
    sortOrder: 100,
    status: "active",
  },
  {
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
    sponsoredCurrencyLabel: DEFAULT_CURRENCY_LABEL,
    sortOrder: 110,
    status: "active",
  },
  {
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
    sponsoredCurrencyLabel: DEFAULT_CURRENCY_LABEL,
    sortOrder: 120,
    status: "active",
  },
  {
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
    sponsoredCurrencyLabel: DEFAULT_CURRENCY_LABEL,
    sortOrder: 130,
    status: "active",
  },
];

function now() {
  return new Date();
}

function getPlatformOperatorUserIdSet() {
  return new Set(
    (process.env.PLATFORM_OPERATOR_USER_IDS || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

function assertPlatformOperator(userId: string, providerUserId?: string | null) {
  const operatorIds = getPlatformOperatorUserIdSet();
  if (!operatorIds.has(userId) && (!providerUserId || !operatorIds.has(providerUserId))) {
    throw new UnauthorizedError("Only platform operators can manage honor projects");
  }
}

function normalizeRequiredText(value: string, fieldLabel: string, maxLength: number) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestError(`${fieldLabel}不能为空。`);
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestError(`${fieldLabel}长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestError(`可选文本长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function normalizeStatus(value: string): HonorProjectStatus {
  if (value === "active" || value === "archived") {
    return value;
  }
  throw new BadRequestError("项目状态无效。");
}

function normalizeMembershipStatus(value: string): HonorProjectMembershipStatus {
  if (value === "pending" || value === "active" || value === "rejected") {
    return value;
  }
  throw new BadRequestError("项目加入状态无效。");
}

function normalizeNonNegativeInt(value: number, fieldLabel: string, maxValue = 10_000_000_000) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new BadRequestError(`${fieldLabel}必须是非负整数。`);
  }
  if (value > maxValue) {
    throw new BadRequestError(`${fieldLabel}不能超过 ${maxValue}。`);
  }
  return value;
}

function normalizePercent(value: number, fieldLabel: string) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new BadRequestError(`${fieldLabel}必须是整数。`);
  }
  if (value < 0 || value > 100) {
    throw new BadRequestError(`${fieldLabel}必须在 0 到 100 之间。`);
  }
  return value;
}

function normalizeBoolean(value: boolean, fieldLabel: string) {
  if (typeof value !== "boolean") {
    throw new BadRequestError(`${fieldLabel}必须是布尔值。`);
  }
  return value;
}

function normalizeUpsertHonorProjectInput(input: UpsertHonorProjectInput) {
  const status = normalizeStatus(input.status);
  return {
    name: normalizeRequiredText(input.name, "项目名称", 120),
    summary: normalizeRequiredText(input.summary, "项目摘要", 2_000),
    publicHref: normalizeOptionalText(input.publicHref ?? null, 500),
    ownerHandle: normalizeRequiredText(input.ownerHandle, "负责人标识", 80),
    ownerLabel: normalizeRequiredText(input.ownerLabel, "负责人名称", 120),
    categoryLabel: normalizeRequiredText(input.categoryLabel, "项目分类", 80),
    stageLabel: normalizeRequiredText(input.stageLabel, "项目阶段", 80),
    progressPercent: normalizePercent(input.progressPercent, "项目进度"),
    progressLabel: normalizeRequiredText(input.progressLabel, "进度说明", 600),
    rewardShareLabel: normalizeRequiredText(input.rewardShareLabel, "分润承诺", 200),
    sponsorOpen: normalizeBoolean(input.sponsorOpen, "赞助状态"),
    sponsorStatusLabel: normalizeRequiredText(input.sponsorStatusLabel, "赞助状态文案", 80),
    joinOpen: normalizeBoolean(input.joinOpen, "加入状态"),
    joinStatusLabel: normalizeRequiredText(input.joinStatusLabel, "加入状态文案", 80),
    collaborationLabel: normalizeRequiredText(input.collaborationLabel, "协作方式", 200),
    fundingTargetAmount: normalizeNonNegativeInt(input.fundingTargetAmount, "目标规模"),
    workspaceHref: normalizeRequiredText(input.workspaceHref, "工作目录链接", 500),
    workspaceLabel: normalizeRequiredText(input.workspaceLabel, "工作目录标签", 80),
    detailBody: normalizeRequiredText(input.detailBody, "项目详情", 4_000),
    sponsorCount: normalizeNonNegativeInt(input.sponsorCount, "资助人数", 1_000_000),
    sponsoredAmount: normalizeNonNegativeInt(input.sponsoredAmount, "资助总额"),
    sponsoredCurrencyLabel: normalizeRequiredText(input.sponsoredCurrencyLabel, "资助货币", 20),
    sortOrder: normalizeNonNegativeInt(input.sortOrder, "排序值", 10_000),
    status,
  };
}

function normalizeUpsertHonorProjectInvestmentInput(input: UpsertHonorProjectInvestmentInput) {
  return {
    projectId: normalizeRequiredText(input.projectId, "项目 ID", 120),
    userId: normalizeRequiredText(input.userId, "用户 ID", 120),
    investedAmount: normalizeNonNegativeInt(input.investedAmount, "个人投资额"),
    currencyLabel: normalizeRequiredText(input.currencyLabel, "投资货币", 20),
  };
}

function normalizeSponsorInput(input: SponsorHonorProjectInput) {
  const currency = input.currency === "obsidian" || input.currency === "mira" ? input.currency : null;
  if (!currency) {
    throw new BadRequestError("赞助货币无效。");
  }
  return {
    amount: normalizeNonNegativeInt(input.amount, "赞助金额"),
    currency,
  };
}

function normalizeJoinInput(input: JoinHonorProjectInput) {
  return {
    roleLabel: normalizeRequiredText(input.roleLabel, "加入身份", 80),
    note: normalizeOptionalText(input.note ?? null, 500),
  };
}

function toHonorProjectShowcaseView(row: typeof honorProjects.$inferSelect): HonorProjectShowcaseView {
  return {
    id: row.id,
    name: row.name,
    summary: row.summary,
    publicHref: row.publicHref,
    ownerHandle: row.ownerHandle,
    ownerLabel: row.ownerLabel,
    categoryLabel: row.categoryLabel,
    stageLabel: row.stageLabel,
    progressPercent: row.progressPercent,
    progressLabel: row.progressLabel,
    rewardShareLabel: row.rewardShareLabel,
    sponsorOpen: row.sponsorOpen,
    sponsorStatusLabel: row.sponsorStatusLabel,
    joinOpen: row.joinOpen,
    joinStatusLabel: row.joinStatusLabel,
    collaborationLabel: row.collaborationLabel,
    fundingTargetAmount: row.fundingTargetAmount,
    workspaceHref: row.workspaceHref,
    workspaceLabel: row.workspaceLabel,
    detailBody: row.detailBody,
    sponsorCount: row.sponsorCount,
    sponsoredAmount: row.sponsoredAmount,
    sponsoredCurrencyLabel: row.sponsoredCurrencyLabel,
  };
}

function toHonorProjectView(row: typeof honorProjects.$inferSelect): HonorProjectView {
  return {
    ...toHonorProjectShowcaseView(row),
    sortOrder: row.sortOrder,
    status: normalizeStatus(row.status),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type InvestmentJoinedRow = {
  id: string;
  projectId: string;
  userId: string;
  investedAmount: number;
  currencyLabel: string;
  createdAt: Date;
  updatedAt: Date;
  projectName: string;
  projectPublicHref: string | null;
  username: string;
};

function toHonorProjectInvestmentView(row: InvestmentJoinedRow): HonorProjectInvestmentView {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectName,
    projectPublicHref: row.projectPublicHref,
    userId: row.userId,
    username: row.username,
    investedAmount: row.investedAmount,
    currencyLabel: row.currencyLabel,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type MembershipJoinedRow = {
  id: string;
  projectId: string;
  userId: string;
  username: string;
  roleLabel: string;
  note: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function toHonorProjectMembershipView(row: MembershipJoinedRow): HonorProjectMembershipView {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    username: row.username,
    roleLabel: row.roleLabel,
    note: row.note,
    status: normalizeMembershipStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeCurrencyLabel(value: string) {
  const token = value.trim().toLowerCase();
  if (token === "mira") return "mira" as const;
  if (token === "obsidian") return "obsidian" as const;
  throw new BadRequestError("项目当前货币暂不支持。");
}

async function listActiveHonorProjects() {
  return db
    .select()
    .from(honorProjects)
    .where(eq(honorProjects.status, "active"))
    .orderBy(asc(honorProjects.sortOrder), desc(honorProjects.updatedAt));
}

export async function ensureHonorProjectCatalogSeeded() {
  const existing = await db.select({ id: honorProjects.id }).from(honorProjects).limit(1);
  if (existing.length > 0) {
    return;
  }

  const timestamp = now();
  for (const seed of bootstrapHonorProjects) {
    await db.insert(honorProjects).values({
      id: crypto.randomUUID(),
      ...normalizeUpsertHonorProjectInput(seed),
      archivedAt: null,
      createdByUserId: null,
      updatedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
}

export async function getHonorProjectPanel(userId: string): Promise<HonorProjectPanelView> {
  const projects = await listActiveHonorProjects();
  const [investmentRows, membershipRows] = await Promise.all([
    db
    .select({
      id: honorProjectInvestments.id,
      projectId: honorProjectInvestments.projectId,
      userId: honorProjectInvestments.userId,
      investedAmount: honorProjectInvestments.investedAmount,
      currencyLabel: honorProjectInvestments.currencyLabel,
      createdAt: honorProjectInvestments.createdAt,
      updatedAt: honorProjectInvestments.updatedAt,
      projectName: honorProjects.name,
      projectPublicHref: honorProjects.publicHref,
      ownerHandle: honorProjects.ownerHandle,
      ownerLabel: honorProjects.ownerLabel,
      categoryLabel: honorProjects.categoryLabel,
      stageLabel: honorProjects.stageLabel,
      progressPercent: honorProjects.progressPercent,
      progressLabel: honorProjects.progressLabel,
      rewardShareLabel: honorProjects.rewardShareLabel,
      sponsorOpen: honorProjects.sponsorOpen,
      sponsorStatusLabel: honorProjects.sponsorStatusLabel,
      joinOpen: honorProjects.joinOpen,
      joinStatusLabel: honorProjects.joinStatusLabel,
      collaborationLabel: honorProjects.collaborationLabel,
      fundingTargetAmount: honorProjects.fundingTargetAmount,
      workspaceHref: honorProjects.workspaceHref,
      workspaceLabel: honorProjects.workspaceLabel,
      detailBody: honorProjects.detailBody,
      username: users.username,
    })
    .from(honorProjectInvestments)
    .innerJoin(honorProjects, eq(honorProjectInvestments.projectId, honorProjects.id))
    .innerJoin(users, eq(honorProjectInvestments.userId, users.id))
    .where(and(eq(honorProjectInvestments.userId, userId), eq(honorProjects.status, "active")))
    .orderBy(desc(honorProjectInvestments.updatedAt))
    .limit(20),
    db
      .select({
        id: honorProjectMemberships.id,
        projectId: honorProjectMemberships.projectId,
        userId: honorProjectMemberships.userId,
        username: users.username,
        roleLabel: honorProjectMemberships.roleLabel,
        note: honorProjectMemberships.note,
        status: honorProjectMemberships.status,
        createdAt: honorProjectMemberships.createdAt,
        updatedAt: honorProjectMemberships.updatedAt,
      })
      .from(honorProjectMemberships)
      .innerJoin(honorProjects, eq(honorProjectMemberships.projectId, honorProjects.id))
      .innerJoin(users, eq(honorProjectMemberships.userId, users.id))
      .where(and(eq(honorProjectMemberships.userId, userId), eq(honorProjects.status, "active")))
      .orderBy(desc(honorProjectMemberships.updatedAt))
      .limit(20),
  ]);

  const investmentProjectCatalog: HonorProjectShowcaseView[] = investmentRows.map((row) => ({
    id: row.projectId,
    name: row.projectName,
    summary: "你已支持该项目，以下为个人投资额。",
    publicHref: row.projectPublicHref,
    ownerHandle: row.ownerHandle,
    ownerLabel: row.ownerLabel,
    categoryLabel: row.categoryLabel,
    stageLabel: row.stageLabel,
    progressPercent: row.progressPercent,
    progressLabel: row.progressLabel,
    rewardShareLabel: row.rewardShareLabel,
    sponsorOpen: row.sponsorOpen,
    sponsorStatusLabel: row.sponsorStatusLabel,
    joinOpen: row.joinOpen,
    joinStatusLabel: row.joinStatusLabel,
    collaborationLabel: row.collaborationLabel,
    fundingTargetAmount: row.fundingTargetAmount,
    workspaceHref: row.workspaceHref,
    workspaceLabel: row.workspaceLabel,
    detailBody: row.detailBody,
    sponsorCount: 0,
    sponsoredAmount: row.investedAmount,
    sponsoredCurrencyLabel: row.currencyLabel,
  }));

  return {
    projectCatalog: projects.map(toHonorProjectShowcaseView),
    investmentProjectCatalog,
    memberships: membershipRows.map(toHonorProjectMembershipView),
  };
}

async function getActiveProjectById(projectId: string) {
  return db
    .select()
    .from(honorProjects)
    .where(and(eq(honorProjects.id, projectId), eq(honorProjects.status, "active")))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function listOperatorHonorProjectCatalog(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input?: {
    investmentUserId?: string | null;
    query?: string | null;
    limit?: number;
  },
): Promise<HonorProjectCatalogView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const projects = await db
    .select()
    .from(honorProjects)
    .orderBy(asc(honorProjects.sortOrder), desc(honorProjects.updatedAt));

  const normalizedQuery = input?.query?.trim() ?? "";
  const normalizedInvestmentUserId = input?.investmentUserId?.trim() ?? "";
  const maxLimit = Math.max(1, Math.min(input?.limit ?? 80, 200));

  const investmentFilters = [];
  if (normalizedInvestmentUserId) {
    investmentFilters.push(eq(honorProjectInvestments.userId, normalizedInvestmentUserId));
  }
  if (normalizedQuery) {
    investmentFilters.push(or(ilike(users.username, `%${normalizedQuery}%`), ilike(honorProjects.name, `%${normalizedQuery}%`)));
  }

  const investments = await db
    .select({
      id: honorProjectInvestments.id,
      projectId: honorProjectInvestments.projectId,
      userId: honorProjectInvestments.userId,
      investedAmount: honorProjectInvestments.investedAmount,
      currencyLabel: honorProjectInvestments.currencyLabel,
      createdAt: honorProjectInvestments.createdAt,
      updatedAt: honorProjectInvestments.updatedAt,
      projectName: honorProjects.name,
      projectPublicHref: honorProjects.publicHref,
      username: users.username,
    })
    .from(honorProjectInvestments)
    .innerJoin(honorProjects, eq(honorProjectInvestments.projectId, honorProjects.id))
    .innerJoin(users, eq(honorProjectInvestments.userId, users.id))
    .where(investmentFilters.length > 0 ? and(...investmentFilters) : undefined)
    .orderBy(desc(honorProjectInvestments.updatedAt))
    .limit(maxLimit);

  return {
    projects: projects.map(toHonorProjectView),
    userInvestments: investments.map(toHonorProjectInvestmentView),
  };
}

export async function createOperatorHonorProject(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: UpsertHonorProjectInput,
): Promise<HonorProjectView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  const normalized = normalizeUpsertHonorProjectInput(input);
  const row = await db
    .insert(honorProjects)
    .values({
      id: crypto.randomUUID(),
      ...normalized,
      archivedAt: normalized.status === "archived" ? timestamp : null,
      createdByUserId: operatorUserId,
      updatedByUserId: operatorUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning()
    .then((rows) => rows[0] ?? null);

  if (!row) {
    throw new BadRequestError("项目创建失败。");
  }
  return toHonorProjectView(row);
}

export async function updateOperatorHonorProject(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  projectId: string,
  input: UpsertHonorProjectInput,
): Promise<HonorProjectView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedProjectId = normalizeRequiredText(projectId, "项目 ID", 120);
  const normalized = normalizeUpsertHonorProjectInput(input);
  const timestamp = now();

  const row = await db
    .update(honorProjects)
    .set({
      ...normalized,
      archivedAt: normalized.status === "archived" ? timestamp : null,
      updatedByUserId: operatorUserId,
      updatedAt: timestamp,
    })
    .where(eq(honorProjects.id, normalizedProjectId))
    .returning()
    .then((rows) => rows[0] ?? null);

  if (!row) {
    throw new NotFoundError("项目不存在。");
  }
  return toHonorProjectView(row);
}

export async function archiveOperatorHonorProject(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  projectId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedProjectId = normalizeRequiredText(projectId, "项目 ID", 120);
  const timestamp = now();
  const row = await db
    .update(honorProjects)
    .set({
      status: "archived",
      archivedAt: timestamp,
      updatedByUserId: operatorUserId,
      updatedAt: timestamp,
    })
    .where(eq(honorProjects.id, normalizedProjectId))
    .returning()
    .then((rows) => rows[0] ?? null);
  if (!row) {
    throw new NotFoundError("项目不存在。");
  }
  return toHonorProjectView(row);
}

export async function deleteOperatorHonorProject(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  projectId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedProjectId = normalizeRequiredText(projectId, "项目 ID", 120);
  const row = await db
    .delete(honorProjects)
    .where(eq(honorProjects.id, normalizedProjectId))
    .returning({ id: honorProjects.id })
    .then((rows) => rows[0] ?? null);
  if (!row) {
    throw new NotFoundError("项目不存在。");
  }
  return row;
}

export async function upsertOperatorHonorProjectInvestment(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: UpsertHonorProjectInvestmentInput,
): Promise<HonorProjectInvestmentView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalized = normalizeUpsertHonorProjectInvestmentInput(input);

  const [project, user] = await Promise.all([
    db
      .select({
        id: honorProjects.id,
      })
      .from(honorProjects)
      .where(eq(honorProjects.id, normalized.projectId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, normalized.userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  if (!project) {
    throw new NotFoundError("项目不存在。");
  }
  if (!user) {
    throw new NotFoundError("用户不存在。");
  }

  const existing = await db
    .select({
      id: honorProjectInvestments.id,
    })
    .from(honorProjectInvestments)
    .where(and(eq(honorProjectInvestments.projectId, normalized.projectId), eq(honorProjectInvestments.userId, normalized.userId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const timestamp = now();
  if (existing) {
    await db
      .update(honorProjectInvestments)
      .set({
        investedAmount: normalized.investedAmount,
        currencyLabel: normalized.currencyLabel,
        updatedByUserId: operatorUserId,
        updatedAt: timestamp,
      })
      .where(eq(honorProjectInvestments.id, existing.id));
  } else {
    await db.insert(honorProjectInvestments).values({
      id: crypto.randomUUID(),
      projectId: normalized.projectId,
      userId: normalized.userId,
      investedAmount: normalized.investedAmount,
      currencyLabel: normalized.currencyLabel,
      createdByUserId: operatorUserId,
      updatedByUserId: operatorUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const row = await db
    .select({
      id: honorProjectInvestments.id,
      projectId: honorProjectInvestments.projectId,
      userId: honorProjectInvestments.userId,
      investedAmount: honorProjectInvestments.investedAmount,
      currencyLabel: honorProjectInvestments.currencyLabel,
      createdAt: honorProjectInvestments.createdAt,
      updatedAt: honorProjectInvestments.updatedAt,
      projectName: honorProjects.name,
      projectPublicHref: honorProjects.publicHref,
      username: users.username,
    })
    .from(honorProjectInvestments)
    .innerJoin(honorProjects, eq(honorProjectInvestments.projectId, honorProjects.id))
    .innerJoin(users, eq(honorProjectInvestments.userId, users.id))
    .where(and(eq(honorProjectInvestments.projectId, normalized.projectId), eq(honorProjectInvestments.userId, normalized.userId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) {
    throw new BadRequestError("个人投资记录保存失败。");
  }

  return toHonorProjectInvestmentView(row);
}

export async function deleteOperatorHonorProjectInvestment(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  investmentId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedInvestmentId = normalizeRequiredText(investmentId, "投资记录 ID", 120);
  const row = await db
    .delete(honorProjectInvestments)
    .where(eq(honorProjectInvestments.id, normalizedInvestmentId))
    .returning({ id: honorProjectInvestments.id })
    .then((rows) => rows[0] ?? null);
  if (!row) {
    throw new NotFoundError("投资记录不存在。");
  }
  return row;
}

export async function sponsorHonorProjectForUser(userId: string, input: SponsorHonorProjectInput & { projectId: string }) {
  const normalizedProjectId = normalizeRequiredText(input.projectId, "项目 ID", 120);
  const normalized = normalizeSponsorInput(input);
  const project = await getActiveProjectById(normalizedProjectId);
  if (!project) {
    throw new NotFoundError("项目不存在。");
  }

  const projectCurrency = normalizeCurrencyLabel(project.sponsoredCurrencyLabel);
  if (projectCurrency !== normalized.currency) {
    throw new BadRequestError("当前项目只支持指定货币赞助。");
  }

  const timestamp = now();
  const referenceId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await deductBalance(
      userId,
      normalized.currency,
      normalized.amount,
      `项目赞助：${project.name}`,
      "honorProjectSponsor",
      referenceId,
      tx,
    );

    const existing = await tx
      .select({
        id: honorProjectInvestments.id,
        investedAmount: honorProjectInvestments.investedAmount,
      })
      .from(honorProjectInvestments)
      .where(
        and(eq(honorProjectInvestments.projectId, normalizedProjectId), eq(honorProjectInvestments.userId, userId)),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (existing) {
      await tx
        .update(honorProjectInvestments)
        .set({
          investedAmount: existing.investedAmount + normalized.amount,
          currencyLabel: project.sponsoredCurrencyLabel,
          updatedByUserId: userId,
          updatedAt: timestamp,
        })
        .where(eq(honorProjectInvestments.id, existing.id));
    } else {
      await tx.insert(honorProjectInvestments).values({
        id: crypto.randomUUID(),
        projectId: normalizedProjectId,
        userId,
        investedAmount: normalized.amount,
        currencyLabel: project.sponsoredCurrencyLabel,
        createdByUserId: userId,
        updatedByUserId: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    await tx
      .update(honorProjects)
      .set({
        sponsorCount: existing ? project.sponsorCount : project.sponsorCount + 1,
        sponsoredAmount: project.sponsoredAmount + normalized.amount,
        updatedByUserId: userId,
        updatedAt: timestamp,
      })
      .where(eq(honorProjects.id, normalizedProjectId));
  });

  return {
    projectId: normalizedProjectId,
    projectName: project.name,
    amount: normalized.amount,
    currencyLabel: project.sponsoredCurrencyLabel,
  };
}

export async function joinHonorProjectForUser(userId: string, input: JoinHonorProjectInput & { projectId: string }) {
  const normalizedProjectId = normalizeRequiredText(input.projectId, "项目 ID", 120);
  const normalized = normalizeJoinInput(input);
  const [project, user] = await Promise.all([
    getActiveProjectById(normalizedProjectId),
    db
      .select({
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  if (!project) {
    throw new NotFoundError("项目不存在。");
  }
  if (!user) {
    throw new NotFoundError("用户不存在。");
  }

  const timestamp = now();
  const existing = await db
    .select({
      id: honorProjectMemberships.id,
    })
    .from(honorProjectMemberships)
    .where(and(eq(honorProjectMemberships.projectId, normalizedProjectId), eq(honorProjectMemberships.userId, userId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) {
    await db
      .update(honorProjectMemberships)
      .set({
        roleLabel: normalized.roleLabel,
        note: normalized.note,
        status: "pending",
        updatedByUserId: userId,
        updatedAt: timestamp,
      })
      .where(eq(honorProjectMemberships.id, existing.id));
  } else {
    await db.insert(honorProjectMemberships).values({
      id: crypto.randomUUID(),
      projectId: normalizedProjectId,
      userId,
      roleLabel: normalized.roleLabel,
      note: normalized.note,
      status: "pending",
      createdByUserId: userId,
      updatedByUserId: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return {
    projectId: normalizedProjectId,
    projectName: project.name,
    roleLabel: normalized.roleLabel,
    status: "pending" as const,
    username: user.username,
  };
}
