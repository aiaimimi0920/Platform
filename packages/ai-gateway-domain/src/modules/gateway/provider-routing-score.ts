import type { GatewayProviderAccountStatus } from "@neuro/contracts";

export type GatewayProviderRoutingScoreInput = {
  status: GatewayProviderAccountStatus;
  failureCount?: number | null;
  breakerOpen?: boolean | null;
  activeConcurrency?: number | null;
  providerConcurrencyLimit?: number | null;
};

export type GatewayProviderRoutingScoreView = {
  score: number;
  healthWeight: number;
  capacityWeight: number;
  degraded: boolean;
  saturated: boolean;
  degradationReasons: string[];
};

function roundScore(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizeStatusWeight(status: GatewayProviderAccountStatus) {
  switch (status) {
    case "active":
      return 1;
    case "cooling":
      return 0.45;
    case "disabled":
      return 0.15;
    case "archived":
      return 0.05;
    default:
      return 0.1;
  }
}

function normalizeFailureWeight(failureCount: number) {
  return Math.max(0.2, 1 - Math.min(8, Math.max(0, failureCount)) * 0.1);
}

function normalizeCapacityWeight(activeConcurrency: number, providerConcurrencyLimit: number | null | undefined) {
  if (!providerConcurrencyLimit || providerConcurrencyLimit <= 0) {
    return 1;
  }
  const safeLimit = Math.max(1, providerConcurrencyLimit);
  const safeActive = Math.max(0, activeConcurrency);
  if (safeActive >= safeLimit) {
    return 0;
  }
  return roundScore((safeLimit - safeActive) / safeLimit);
}

export function buildGatewayProviderRoutingScore(
  input: GatewayProviderRoutingScoreInput,
): GatewayProviderRoutingScoreView {
  const failureCount = Math.max(0, input.failureCount ?? 0);
  const activeConcurrency = Math.max(0, input.activeConcurrency ?? 0);
  const breakerOpen = Boolean(input.breakerOpen);
  const statusWeight = normalizeStatusWeight(input.status);
  const failureWeight = normalizeFailureWeight(failureCount);
  const healthWeight = roundScore(statusWeight * failureWeight);
  const capacityWeight = normalizeCapacityWeight(activeConcurrency, input.providerConcurrencyLimit ?? null);
  const saturated = capacityWeight <= 0;

  if (breakerOpen) {
    return {
      score: 0,
      healthWeight: 0,
      capacityWeight,
      degraded: true,
      saturated,
      degradationReasons: ["breaker_open"],
    };
  }

  const degradationReasons: string[] = [];
  if (input.status !== "active") {
    degradationReasons.push(`status_${input.status}`);
  }
  if (failureCount >= 3) {
    degradationReasons.push("failure_count_elevated");
  }
  if (saturated) {
    degradationReasons.push("concurrency_saturated");
  } else if (capacityWeight < 0.5) {
    degradationReasons.push("concurrency_pressure");
  }

  return {
    score: roundScore(healthWeight * capacityWeight),
    healthWeight,
    capacityWeight,
    degraded: degradationReasons.length > 0,
    saturated,
    degradationReasons,
  };
}
