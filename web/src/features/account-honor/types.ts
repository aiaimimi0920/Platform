import type { ReputationSummary, UserProgressionSnapshot } from "@neuro/contracts";

export type AccountHonorAbilityMetricKey =
  | "growth"
  | "reputation"
  | "collaboration"
  | "agents"
  | "assets"
  | "access";

export type AccountHonorAbilityMetric = {
  key: AccountHonorAbilityMetricKey;
  label: string;
  shortLabel: string;
  score: number;
  value: string;
  note: string;
};

export type AccountHonorActivityLevel = 0 | 1 | 2 | 3 | 4;

export type AccountHonorActivityCell = {
  date: string;
  count: number;
  level: AccountHonorActivityLevel;
  title: string;
  future: boolean;
};

export type AccountHonorActivityWeek = {
  key: string;
  days: AccountHonorActivityCell[];
};

export type AccountHonorActivityMonthMarker = {
  key: string;
  label: string;
  weekIndex: number;
};

export type AccountHonorActivityHeatmap = {
  weeks: AccountHonorActivityWeek[];
  months: AccountHonorActivityMonthMarker[];
  totalSignals: number;
  activeDayCount: number;
  maxCount: number;
  rangeLabel: string;
  lastActiveLabel: string | null;
};

export type AccountHonorTaskPerformance = {
  acceptedCount: number;
  fulfilledCount: number;
  fulfillmentRate: number | null;
  positiveRate: number | null;
  reputationScore: number | null;
  reputationScoreOutOf: number;
  spentValue: number;
  netValue: number;
};

export type AccountHonorAgentShowcase = {
  id: string;
  name: string;
  direction: string;
  reputationScore: number | null;
  positiveRate: number | null;
  fulfillmentCount: number;
  fulfillmentRate: number | null;
  producedValue: number;
  spentValue: number;
  netValue: number;
};

export type AccountHonorAgentCatalogEntry = AccountHonorAgentShowcase & {
  enabled: boolean;
};

export type AccountHonorProjectShowcase = {
  id: string;
  name: string;
  summary: string;
  publicHref: string | null;
  ownerHandle: string;
  ownerLabel: string;
  categoryLabel: string;
  stageLabel: string;
  progressPercent: number;
  progressLabel: string;
  rewardShareLabel: string;
  sponsorOpen: boolean;
  sponsorStatusLabel: string;
  joinOpen: boolean;
  joinStatusLabel: string;
  collaborationLabel: string;
  fundingTargetAmount: number;
  workspaceHref: string;
  workspaceLabel: string;
  detailBody: string;
  sponsorCount: number;
  sponsoredAmount: number;
  sponsoredCurrencyLabel: string;
};

export type AccountHonorSponsorshipSummary = {
  sponsoredCount: number;
  totalAmount: number;
  currencyLabel: string;
  sponsoredProjects: AccountHonorProjectShowcase[];
};

export type AccountHonorIssueShowcase = {
  id: string;
  name: string;
  summary: string;
  publicHref: string | null;
  supporterCount: number;
  supportedAmount: number;
  supportedCurrencyLabel: string;
  supportRate: number;
  statusLabel: string;
};

export type AccountHonorIssueSupportSummary = {
  supportedCount: number;
  totalAmount: number;
  currencyLabel: string;
  supportedIssues: AccountHonorIssueShowcase[];
};

export type AccountHonorPanelData = {
  accountAvatarUrl: string | null;
  accountDisplayName: string;
  profileTagline: string | null;
  abilityMetrics: AccountHonorAbilityMetric[];
  activityHeatmap: AccountHonorActivityHeatmap;
  agentCatalog: AccountHonorAgentCatalogEntry[];
  agentShowcase: AccountHonorAgentShowcase[];
  projectCatalog: AccountHonorProjectShowcase[];
  projectShowcase: AccountHonorProjectShowcase[];
  investmentProjectCatalog: AccountHonorProjectShowcase[];
  sponsorshipSummary: AccountHonorSponsorshipSummary;
  issueCatalog: AccountHonorIssueShowcase[];
  issueShowcase: AccountHonorIssueShowcase[];
  investmentIssueCatalog: AccountHonorIssueShowcase[];
  issueSupportSummary: AccountHonorIssueSupportSummary;
  arbitrationOpenCount: number;
  enabledAgentCount: number;
  joinedAtLabel: string;
  listedAssetCount: number;
  nextLevelLabel: string;
  progression: UserProgressionSnapshot | null;
  providerUserId: string;
  reputation: ReputationSummary | null;
  taskPerformance: AccountHonorTaskPerformance;
  taskActiveCount: number;
  totalAssetCount: number;
  trustLevel: number | null;
  unlockedAccessCount: number;
};

export type AccountHonorArchiveSectionProps = Pick<
  AccountHonorPanelData,
  | "abilityMetrics"
  | "activityHeatmap"
  | "progression"
  | "projectCatalog"
  | "projectShowcase"
  | "investmentProjectCatalog"
  | "sponsorshipSummary"
  | "issueCatalog"
  | "issueShowcase"
  | "investmentIssueCatalog"
  | "issueSupportSummary"
> & {
  showHeader?: boolean;
};

export type AccountHonorCenterProps = AccountHonorPanelData;

export type AccountHonorSignalSectionProps = {
  accountAvatarUrl: string | null;
  accountDisplayName: string;
  joinedAtLabel: string;
  nextLevelLabel: string;
  progression: UserProgressionSnapshot | null;
  providerUserId: string;
  reputation: ReputationSummary | null;
  trustLevel: number | null;
  unlockedAccessCount: number;
};
