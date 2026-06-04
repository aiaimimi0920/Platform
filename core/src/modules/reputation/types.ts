export type ReputationComputationInput = {
  completedTaskCount: number;
  defaultedTaskCount: number;
  cancelledTaskCount: number;
  activeTaskCount: number;
  favorableArbitrationCount: number;
  unfavorableArbitrationCount: number;
  trustLevel: number | null;
};

export type ReputationScoreFactors = {
  baseScore: number;
  trustBonus: number;
  completedContribution: number;
  defaultedPenalty: number;
  cancelledPenalty: number;
  activeContribution: number;
  arbitrationWinBonus: number;
  arbitrationLossPenalty: number;
};

export type ReputationComputedResult = {
  reputationScore: number;
  completionRate: number;
  defaultRate: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  factors: ReputationScoreFactors;
};

export type ReputationBreakdown = {
  userId: string;
  factors: ReputationScoreFactors;
  inputs: ReputationComputationInput;
  completionRate: number;
  defaultRate: number;
  reputationScore: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  updatedAt: string;
};

export type ReputationHistoryPoint = {
  id: string;
  userId: string;
  reputationScore: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  completionRate: number;
  defaultRate: number;
  completedTaskCount: number;
  defaultedTaskCount: number;
  cancelledTaskCount: number;
  activeTaskCount: number;
  favorableArbitrationCount: number;
  unfavorableArbitrationCount: number;
  trustLevel: number;
  factors: ReputationScoreFactors;
  recordedAt: string;
};

export type ReputationDispatchProfile = {
  userId: string;
  reputationScore: number;
  completionRate: number;
  defaultRate: number;
  trustLevel: number;
};
