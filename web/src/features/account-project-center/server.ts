import "server-only";

import type { HonorProjectShowcaseView } from "@neuro/contracts";

import { getCurrentUser, getHonorProjectPanel } from "@/lib/account-client";
import { requirePlatformUserContext } from "@/lib/platform-session";

import {
  PROJECT_FALLBACK_CATALOG,
  PROJECT_PRESENTATION_LIBRARY,
  type ProjectCardView,
  type ProjectCenterPanelView,
  type ProjectCenterScope,
  type ProjectOwnerDirectoryEntry,
  type ProjectPresentationProfile,
} from "./model";

function normalizeToken(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_./-]+/g, "");
}

function extractProjectSlug(project: HonorProjectShowcaseView) {
  const hrefSlug = (project.publicHref ?? "").split("/").filter(Boolean).pop();
  if (hrefSlug) {
    return hrefSlug;
  }
  return normalizeToken(project.name);
}

function resolveProjectProfile(project: HonorProjectShowcaseView): ProjectPresentationProfile {
  const slug = extractProjectSlug(project);
  const matched = PROJECT_PRESENTATION_LIBRARY[slug];
  if (matched) {
    return matched;
  }

  return {
    ownerHandle: "neuroloom",
    ownerLabel: "NeuroLoom 团队",
    categoryLabel: "人工智能",
    stageLabel: "方案整理",
    progressPercent: 24,
    progressLabel: "当前仍处于前期方案整理阶段，细项能力会随着更多真实字段接入而细化。",
    rewardShareLabel: "收益分成方案待后续明确",
    sponsorOpen: false,
    sponsorStatusLabel: "暂未开放",
    joinOpen: false,
    joinStatusLabel: "后续开放",
    collaborationLabel: "外部协作待开放",
    fundingTargetAmount: Math.max(project.sponsoredAmount, 1) * 2,
    workspaceHref: "https://github.com/neuroloom-labs",
    workspaceLabel: "外部工作目录",
    detailBody:
      "当前项目详情仍以面板可读性和协作说明为主，后续会把更多真实的阶段、分润和外部目录字段落回账户域模型。",
    milestoneItems: [
      { key: `${project.id}-m1`, label: "方案整理", note: "当前面板展示先以聚合信息为主。", status: "active" },
      { key: `${project.id}-m2`, label: "详情扩展", note: "后续补齐阶段、分润与外部目录字段。", status: "planned" },
    ],
  };
}

function dedupeProjects(catalog: HonorProjectShowcaseView[]) {
  const seen = new Set<string>();
  const next: HonorProjectShowcaseView[] = [];
  for (const project of catalog) {
    if (seen.has(project.id)) {
      continue;
    }
    seen.add(project.id);
    next.push(project);
  }
  return next;
}

function decorateProject(args: {
  currentUserHandle: string | null;
  investmentAmountByProjectId: Map<string, number>;
  membershipByProjectId: Map<string, { roleLabel: string; status: "pending" | "active" | "rejected" }>;
  project: HonorProjectShowcaseView;
}): ProjectCardView {
  const { currentUserHandle, investmentAmountByProjectId, membershipByProjectId, project } = args;
  const profile = resolveProjectProfile(project);
  const membership = membershipByProjectId.get(project.id) ?? null;
  const personalSponsoredAmount = investmentAmountByProjectId.get(project.id) ?? 0;
  const ownerHandle = project.ownerHandle || profile.ownerHandle;
  const ownerLabel = project.ownerLabel || profile.ownerLabel;
  const categoryLabel = project.categoryLabel || profile.categoryLabel;
  const stageLabel = project.stageLabel || profile.stageLabel;
  const progressPercent = Number.isFinite(project.progressPercent) ? project.progressPercent : profile.progressPercent;
  const progressLabel = project.progressLabel || profile.progressLabel;
  const rewardShareLabel = project.rewardShareLabel || profile.rewardShareLabel;
  const sponsorOpen = project.sponsorOpen ?? profile.sponsorOpen;
  const sponsorStatusLabel = project.sponsorStatusLabel || profile.sponsorStatusLabel;
  const joinOpen = project.joinOpen ?? profile.joinOpen;
  const joinStatusLabel = project.joinStatusLabel || profile.joinStatusLabel;
  const collaborationLabel = project.collaborationLabel || profile.collaborationLabel;
  const fundingTargetAmount = Math.max(
    project.sponsoredAmount,
    project.fundingTargetAmount || profile.fundingTargetAmount,
  );
  const workspaceHref = project.workspaceHref || profile.workspaceHref;
  const workspaceLabel = project.workspaceLabel || profile.workspaceLabel;
  const detailBody = project.detailBody || profile.detailBody;
  const ownerMatchesCurrentUser =
    Boolean(currentUserHandle) &&
    [ownerHandle, ...(profile.ownerAliases ?? [])].map(normalizeToken).includes(currentUserHandle as string);

  return {
    ...project,
    categoryLabel,
    collaborationLabel,
    detailBody,
    fundingTargetAmount,
    fundingTargetCurrencyLabel: project.sponsoredCurrencyLabel,
    isOwnedByCurrentUser: ownerMatchesCurrentUser,
    isUserBackedProject: personalSponsoredAmount > 0,
    joinOpen,
    joinStatusLabel,
    membershipRoleLabel: membership?.roleLabel ?? null,
    membershipStatus: membership?.status ?? "none",
    milestoneItems: profile.milestoneItems,
    ownerHandle,
    ownerLabel,
    personalSponsoredAmount,
    progressLabel,
    progressPercent,
    rewardShareLabel,
    sponsorOpen,
    sponsorStatusLabel,
    stageLabel,
    workspaceHref,
    workspaceLabel,
  };
}

function buildOwnerDirectory(projects: ProjectCardView[]): ProjectOwnerDirectoryEntry[] {
  const directory = new Map<string, ProjectOwnerDirectoryEntry>();
  for (const project of projects) {
    if (!directory.has(project.ownerHandle)) {
      directory.set(project.ownerHandle, {
        handle: project.ownerHandle,
        label: project.ownerLabel,
      });
    }
  }
  return [...directory.values()].sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
}

function resolveOwnerHandleSelection(args: {
  ownerDirectory: ProjectOwnerDirectoryEntry[];
  ownerParam?: string | null;
  projects: ProjectCardView[];
}) {
  const requested = normalizeToken(args.ownerParam);
  const fallbackHandle = args.ownerDirectory[0]?.handle ?? null;
  if (!requested) {
    return fallbackHandle;
  }

  const direct = args.ownerDirectory.find((owner) => normalizeToken(owner.handle) === requested);
  if (direct) {
    return direct.handle;
  }

  const byLabel = args.ownerDirectory.find(
    (owner) => normalizeToken(owner.label) === requested || normalizeToken(owner.label).includes(requested),
  );
  if (byLabel) {
    return byLabel.handle;
  }

  const byAlias = args.projects.find((project) => {
    const profile = resolveProjectProfile(project);
    return [project.ownerHandle, ...(profile.ownerAliases ?? [])].map(normalizeToken).includes(requested);
  });
  if (byAlias) {
    return byAlias.ownerHandle;
  }

  return fallbackHandle;
}

export function resolveProjectScope(value: string | null | undefined): ProjectCenterScope {
  return value === "mine" || value === "person" || value === "hot" ? value : "hot";
}

export function buildProjectHref(args: {
  owner?: string | null;
  project?: string | null;
  scope?: ProjectCenterScope;
}) {
  const params = new URLSearchParams();
  if (args.scope && args.scope !== "hot") {
    params.set("scope", args.scope);
  }
  if (args.owner) {
    params.set("owner", args.owner);
  }
  if (args.project) {
    params.set("project", args.project);
  }
  const query = params.toString();
  return query ? `/projects?${query}` : "/projects";
}

export async function getProjectCenterPanel(): Promise<ProjectCenterPanelView> {
  const userContext = await requirePlatformUserContext();
  const currentUser = await getCurrentUser(userContext).catch(() => null);
  const projectPanel = await getHonorProjectPanel(userContext).catch(() => ({
    projectCatalog: PROJECT_FALLBACK_CATALOG,
    investmentProjectCatalog: [],
    memberships: [],
  }));

  const currentUserHandle = normalizeToken(currentUser?.username ?? userContext.username ?? null) || null;
  const investmentAmountByProjectId = new Map(
    projectPanel.investmentProjectCatalog.map((project) => [project.id, project.sponsoredAmount] as const),
  );
  const membershipByProjectId = new Map(
    projectPanel.memberships.map((membership) => [
      membership.projectId,
      { roleLabel: membership.roleLabel, status: membership.status },
    ]),
  );
  const hotProjects = dedupeProjects(projectPanel.projectCatalog)
    .map((project) => decorateProject({ project, currentUserHandle, investmentAmountByProjectId, membershipByProjectId }))
    .sort((left, right) => right.sponsoredAmount - left.sponsoredAmount || right.sponsorCount - left.sponsorCount);

  const myProjects = dedupeProjects([
    ...projectPanel.investmentProjectCatalog,
    ...projectPanel.projectCatalog.filter((project) => membershipByProjectId.has(project.id)),
    ...projectPanel.projectCatalog.filter((project) => {
      const profile = resolveProjectProfile(project);
      const candidateTokens = [project.ownerHandle || profile.ownerHandle, ...(profile.ownerAliases ?? [])].map(
        normalizeToken,
      );
      return currentUserHandle ? candidateTokens.includes(currentUserHandle) : false;
    }),
  ])
    .map((project) => decorateProject({ project, currentUserHandle, investmentAmountByProjectId, membershipByProjectId }))
    .sort((left, right) => {
      const leftWeight =
        (left.isOwnedByCurrentUser ? 400 : 0) +
        (left.membershipStatus === "active" ? 300 : left.membershipStatus === "pending" ? 200 : left.membershipStatus === "rejected" ? 100 : 0) +
        (left.personalSponsoredAmount > 0 ? 80 : 0);
      const rightWeight =
        (right.isOwnedByCurrentUser ? 400 : 0) +
        (right.membershipStatus === "active" ? 300 : right.membershipStatus === "pending" ? 200 : right.membershipStatus === "rejected" ? 100 : 0) +
        (right.personalSponsoredAmount > 0 ? 80 : 0);
      return (
        rightWeight - leftWeight ||
        right.personalSponsoredAmount - left.personalSponsoredAmount ||
        right.sponsoredAmount - left.sponsoredAmount
      );
    });

  return {
    currentUser,
    hotProjects,
    myProjects,
    ownerDirectory: buildOwnerDirectory(hotProjects),
  };
}

export function resolveProjectCollection(args: {
  ownerParam?: string | null;
  panel: ProjectCenterPanelView;
  scope: ProjectCenterScope;
}) {
  if (args.scope === "mine") {
    return {
      activeOwner: null,
      emptyLabel: "当前还没有可展示的我的项目。",
      projects: args.panel.myProjects,
      scopeLabel: "我的项目",
    };
  }

  if (args.scope === "person") {
    const selectedOwner = resolveOwnerHandleSelection({
      ownerDirectory: args.panel.ownerDirectory,
      ownerParam: args.ownerParam,
      projects: args.panel.hotProjects,
    });
    const ownerMeta =
      args.panel.ownerDirectory.find((owner) => owner.handle === selectedOwner) ?? args.panel.ownerDirectory[0] ?? null;
    const projects = selectedOwner
      ? args.panel.hotProjects.filter((project) => project.ownerHandle === selectedOwner)
      : [];

    return {
      activeOwner: ownerMeta,
      emptyLabel: "该名下当前暂无项目。",
      projects,
      scopeLabel: ownerMeta ? `${ownerMeta.label} 名下项目` : "某人项目",
    };
  }

  return {
    activeOwner: null,
    emptyLabel: "当前暂无热门项目。",
    projects: args.panel.hotProjects,
    scopeLabel: "热门项目",
  };
}
