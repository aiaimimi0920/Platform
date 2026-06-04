import type { CurrencyKey } from "./index";

export const missionKinds = ["checkin", "daily", "weekly", "permanent", "event"] as const;

export type MissionKind = (typeof missionKinds)[number];

export const missionStatuses = ["draft", "active", "archived"] as const;

export type MissionStatus = (typeof missionStatuses)[number];

export const missionResetRules = ["daily", "weekly", "none", "event_window"] as const;

export type MissionResetRule = (typeof missionResetRules)[number];

export const missionStreakModes = ["none", "daily_checkin"] as const;

export type MissionStreakMode = (typeof missionStreakModes)[number];

export const missionMetricKeys = [
  "dailyCheckInClaim",
  "taskApply",
  "mailClaim",
  "productPurchase",
  "opinionSupport",
] as const;

export type MissionMetricKey = (typeof missionMetricKeys)[number];

export const missionTabKeys = ["checkin", "permanent", "daily", "weekly", "event"] as const;

export type MissionTabKey = (typeof missionTabKeys)[number];

export type MissionCheckinRewardView = {
  fixedAmount: number;
  bonusAmount: number;
  bonusSourceWagerAmount: number | null;
  bonusMultiplier: number;
  previewText: string;
};

export type MissionCheckinWagerView = {
  canPlaceToday: boolean;
  todayWagerAmount: number | null;
  todayBonusAmount: number | null;
  minAmount: number;
  maxAmount: number;
  rewardPeriodKey: string;
  placedAt: string | null;
};

export type MissionCardView = {
  id: string;
  kind: MissionKind;
  status: MissionStatus;
  title: string;
  subtitle: string | null;
  description: string;
  eyebrow: string;
  rewardCurrency: CurrencyKey;
  rewardAmount: number;
  metricKey: MissionMetricKey;
  progressCurrent: number;
  progressTarget: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
  available: boolean;
  lockedReason: string | null;
  periodKey: string | null;
  nextEligibleAt: string | null;
  streakDays: number | null;
  streakTarget: number | null;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  claimedAt: string | null;
  checkinReward: MissionCheckinRewardView | null;
  checkinWager: MissionCheckinWagerView | null;
};

export type MissionTabSummaryView = {
  key: MissionTabKey;
  label: string;
  totalCount: number;
  claimableCount: number;
};

export type MissionPanelView = {
  tabs: MissionTabSummaryView[];
  defaultTab: MissionTabKey;
  checkin: MissionCardView | null;
  permanent: MissionCardView[];
  daily: MissionCardView[];
  weekly: MissionCardView[];
  event: MissionCardView[];
  generatedAt: string;
};

export type MissionClaimResult = {
  missionId: string;
  kind: MissionKind;
  rewardCurrency: CurrencyKey;
  claimedAmount: number;
  baseRewardAmount: number | null;
  bonusRewardAmount: number | null;
  bonusSourceWagerAmount: number | null;
  rewardPreviewText: string | null;
  claimedAt: string;
  periodKey: string;
  streakDays: number | null;
};

export type MissionCheckinWagerResult = {
  missionId: string;
  rewardCurrency: CurrencyKey;
  wagerAmount: number;
  bonusAmount: number;
  bonusMultiplier: number;
  fixedRewardAmount: number;
  rewardPeriodKey: string;
  previewText: string;
  placedAt: string;
};

export type UpsertMissionDefinitionInput = {
  kind: MissionKind;
  status: MissionStatus;
  title: string;
  subtitle: string | null;
  description: string;
  eyebrow: string;
  rewardCurrency: CurrencyKey;
  rewardAmount: number;
  metricKey: MissionMetricKey;
  progressTarget: number;
  streakTarget: number | null;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
};

export type MissionDefinitionView = {
  id: string;
  kind: MissionKind;
  status: MissionStatus;
  title: string;
  subtitle: string | null;
  description: string;
  eyebrow: string;
  rewardCurrency: CurrencyKey;
  rewardAmount: number;
  metricKey: MissionMetricKey;
  progressTarget: number;
  resetRule: MissionResetRule;
  streakMode: MissionStreakMode;
  streakTarget: number | null;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};
