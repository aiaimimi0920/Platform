export const honorProjectStatuses = ["active", "archived"] as const;
export const honorProjectMembershipStatuses = ["pending", "active", "rejected"] as const;

export type HonorProjectStatus = (typeof honorProjectStatuses)[number];
export type HonorProjectMembershipStatus = (typeof honorProjectMembershipStatuses)[number];

export type HonorProjectShowcaseView = {
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

export type HonorProjectView = HonorProjectShowcaseView & {
  sortOrder: number;
  status: HonorProjectStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HonorProjectInvestmentView = {
  id: string;
  projectId: string;
  projectName: string;
  projectPublicHref: string | null;
  userId: string;
  username: string;
  investedAmount: number;
  currencyLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type HonorProjectMembershipView = {
  id: string;
  projectId: string;
  userId: string;
  username: string;
  roleLabel: string;
  note: string | null;
  status: HonorProjectMembershipStatus;
  createdAt: string;
  updatedAt: string;
};

export type HonorProjectCatalogView = {
  projects: HonorProjectView[];
  userInvestments: HonorProjectInvestmentView[];
};

export type HonorProjectPanelView = {
  projectCatalog: HonorProjectShowcaseView[];
  investmentProjectCatalog: HonorProjectShowcaseView[];
  memberships: HonorProjectMembershipView[];
};

export type UpsertHonorProjectInput = {
  name: string;
  summary: string;
  publicHref?: string | null;
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
  sortOrder: number;
  status: HonorProjectStatus;
};

export type UpsertHonorProjectInvestmentInput = {
  projectId: string;
  userId: string;
  investedAmount: number;
  currencyLabel: string;
};

export type SponsorHonorProjectInput = {
  amount: number;
  currency: "obsidian" | "mira";
};

export type JoinHonorProjectInput = {
  roleLabel: string;
  note?: string | null;
};
