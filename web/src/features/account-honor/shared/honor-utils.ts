/**
 * Pure utility functions shared between owner and visitor views.
 * No session/auth dependencies.
 */
import type { ReactNode } from "react";

import type {
  AccountHonorAbilityMetric,
  AccountHonorAgentShowcase,
  AccountHonorArchiveSectionProps,
  AccountHonorIssueShowcase,
  AccountHonorProjectShowcase,
  AccountHonorSponsorshipSummary,
  AccountHonorIssueSupportSummary,
  AccountHonorPanelData,
} from "../types";

export const HONOR_ABILITY_AXIS_COUNT = 6;
export const HONOR_ABILITY_CHART_SIZE = 288;
export const HONOR_ABILITY_CENTER = HONOR_ABILITY_CHART_SIZE / 2;
export const HONOR_ABILITY_RADIUS = 110;
export const HONOR_ACTIVITY_DAY_LABELS = [
  { label: "Mon", row: 0 },
  { label: "Wed", row: 2 },
  { label: "Fri", row: 4 },
] as const;
export const HONOR_ABILITY_COPY_OFFSETS = [
  { dx: 0, dy: -14 },
  { dx: 12, dy: -6 },
  { dx: 12, dy: 10 },
  { dx: 0, dy: 16 },
  { dx: -12, dy: 10 },
  { dx: -12, dy: -6 },
] as const;

export function buildHonorSourceRows(progression: AccountHonorArchiveSectionProps["progression"]) {
  const rows = [...(progression?.sources ?? [])].sort((left, right) => {
    const experienceDiff = right.experience - left.experience;
    if (experienceDiff !== 0) {
      return experienceDiff;
    }
    return right.metricValue - left.metricValue;
  });

  const maxExperience = Math.max(...rows.map((row) => row.experience), 1);
  return rows.map((row) => ({
    ...row,
    width: Math.max(6, Math.round((row.experience / maxExperience) * 100)),
  }));
}

export function buildProgressSignal(progression: AccountHonorArchiveSectionProps["progression"]) {
  if (!progression) {
    return "成长信号未同步";
  }

  if (progression.experienceToNextLevel === null) {
    return "已达当前最高等级";
  }

  const { formatAccountNumber } = require("@/lib/account-center");
  return `距下一阶 ${formatAccountNumber(progression.experienceToNextLevel)} XP`;
}

export function clampMetricScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildHexPoint(index: number, radius: number) {
  const angle = ((-90 + (360 / HONOR_ABILITY_AXIS_COUNT) * index) * Math.PI) / 180;
  return {
    x: HONOR_ABILITY_CENTER + Math.cos(angle) * radius,
    y: HONOR_ABILITY_CENTER + Math.sin(angle) * radius,
  };
}

export function buildPolygonPoints(values: number[], radius: number) {
  return values
    .map((value, index) => {
      const point = buildHexPoint(index, radius * value);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

export function buildRingPoints(radiusRatio: number) {
  return buildPolygonPoints(new Array(HONOR_ABILITY_AXIS_COUNT).fill(radiusRatio), HONOR_ABILITY_RADIUS);
}

export function getAbilityLabelAnchor(x: number) {
  if (Math.abs(x - HONOR_ABILITY_CENTER) < 8) {
    return "middle";
  }
  return x < HONOR_ABILITY_CENTER ? "end" : "start";
}

export function formatHonorCurrencyValue(value: number, currencyLabel = "MIRA") {
  const { formatAccountNumber } = require("@/lib/account-center");
  return `${formatAccountNumber(value)} ${currencyLabel}`;
}

export function selectShowcasedAgents(
  agentCatalog: AccountHonorPanelData["agentCatalog"],
  showcasedAgentIds: string[],
) {
  if (showcasedAgentIds.length === 0) {
    return agentCatalog.slice(0, 4);
  }

  const catalogById = new Map(agentCatalog.map((agent) => [agent.id, agent] as const));
  return showcasedAgentIds
    .map((agentId) => catalogById.get(agentId) ?? null)
    .filter((agent): agent is (typeof agentCatalog)[number] => Boolean(agent))
    .slice(0, 4);
}

export function selectShowcasedProjects(
  projectCatalog: AccountHonorProjectShowcase[],
  showcasedProjectIds: string[],
  limit = 4,
) {
  if (showcasedProjectIds.length === 0) {
    return projectCatalog.slice(0, limit);
  }

  const catalogById = new Map(projectCatalog.map((project) => [project.id, project] as const));
  return showcasedProjectIds
    .map((projectId) => catalogById.get(projectId) ?? null)
    .filter((project): project is AccountHonorProjectShowcase => Boolean(project))
    .slice(0, limit);
}

export function selectShowcasedIssues(
  issueCatalog: AccountHonorIssueShowcase[],
  showcasedIssueIds: string[],
  limit = 4,
) {
  if (showcasedIssueIds.length === 0) {
    return issueCatalog.slice(0, limit);
  }

  const catalogById = new Map(issueCatalog.map((issue) => [issue.id, issue] as const));
  return showcasedIssueIds
    .map((issueId) => catalogById.get(issueId) ?? null)
    .filter((issue): issue is AccountHonorIssueShowcase => Boolean(issue))
    .slice(0, limit);
}

export function buildLocalSponsorshipSummary(
  investmentProjectCatalog: AccountHonorProjectShowcase[],
  showcasedProjectIds: string[],
): AccountHonorSponsorshipSummary {
  const sponsoredProjects = selectShowcasedProjects(investmentProjectCatalog, showcasedProjectIds, 3);
  return {
    sponsoredCount: sponsoredProjects.length,
    totalAmount: sponsoredProjects.reduce((sum, project) => sum + project.sponsoredAmount, 0),
    currencyLabel:
      sponsoredProjects[0]?.sponsoredCurrencyLabel ?? investmentProjectCatalog[0]?.sponsoredCurrencyLabel ?? "MIRA",
    sponsoredProjects,
  };
}

export function buildLocalIssueSupportSummary(
  investmentIssueCatalog: AccountHonorIssueShowcase[],
  showcasedIssueIds: string[],
): AccountHonorIssueSupportSummary {
  const supportedIssues = selectShowcasedIssues(investmentIssueCatalog, showcasedIssueIds, 3);
  return {
    supportedCount: supportedIssues.length,
    totalAmount: supportedIssues.reduce((sum, issue) => sum + issue.supportedAmount, 0),
    currencyLabel: supportedIssues[0]?.supportedCurrencyLabel ?? investmentIssueCatalog[0]?.supportedCurrencyLabel ?? "投票券",
    supportedIssues,
  };
}

export function buildHonorRankLabel(
  progression: AccountHonorArchiveSectionProps["progression"],
  trustLevel: number | null,
) {
  if (progression) {
    return `${progression.level}kyu`;
  }
  if (trustLevel !== null) {
    return `${trustLevel}kyu`;
  }
  return "UNRANKED";
}
