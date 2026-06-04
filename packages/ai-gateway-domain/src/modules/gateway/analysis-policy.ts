import type {
  GatewayAnalysisAnomalyPolicySummaryView,
  GatewayAnalysisAnomalyPolicySyncStatus,
  GatewayAnalysisAnomalyPolicyView,
  GatewaySummaryBucket,
} from "@neuro/contracts";
import { countGatewayAnalysisAutoRemediationEnabledPolicies } from "./analysis-auto-remediation";

function pushBucket(map: Map<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() ?? "";
  if (!normalized) {
    return;
  }
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toBuckets(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count } satisfies GatewaySummaryBucket))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function resolveGatewayAnalysisAnomalyPolicySchedule(args: {
  status: string;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number | null;
  lastSyncedAt: string | null;
  now?: Date;
}) {
  if (args.status !== "enabled" || !args.autoSyncEnabled) {
    return {
      nextSyncDueAt: null,
      syncDue: false,
    };
  }

  const intervalMinutes = args.autoSyncIntervalMinutes ?? 60;
  const referenceTime = args.lastSyncedAt ? new Date(args.lastSyncedAt) : null;
  if (referenceTime && Number.isFinite(referenceTime.getTime())) {
    const nextSyncDueAtDate = new Date(referenceTime.getTime() + intervalMinutes * 60_000);
    const now = args.now ?? new Date();
    return {
      nextSyncDueAt: nextSyncDueAtDate.toISOString(),
      syncDue: nextSyncDueAtDate.getTime() <= now.getTime(),
    };
  }

  return {
    nextSyncDueAt: null,
    syncDue: true,
  };
}

export function buildGatewayAnalysisAnomalyPolicySummary(
  policies: GatewayAnalysisAnomalyPolicyView[],
): GatewayAnalysisAnomalyPolicySummaryView {
  const byStatus = new Map<string, number>();
  const bySyncStatus = new Map<string, number>();
  let enabledPolicies = 0;
  let disabledPolicies = 0;
  let autoSyncEnabledPolicies = 0;
  let autoEscalateEnabledPolicies = 0;
  let alertingEnabledPolicies = 0;
  let duePolicies = 0;

  for (const policy of policies) {
    pushBucket(byStatus, policy.status);
    pushBucket(bySyncStatus, policy.lastSyncStatus as GatewayAnalysisAnomalyPolicySyncStatus | null);
    if (policy.status === "enabled") {
      enabledPolicies += 1;
    } else if (policy.status === "disabled") {
      disabledPolicies += 1;
    }
    if (policy.autoSyncEnabled) {
      autoSyncEnabledPolicies += 1;
    }
    if (policy.autoEscalateEnabled) {
      autoEscalateEnabledPolicies += 1;
    }
    if (policy.alertingEnabled) {
      alertingEnabledPolicies += 1;
    }
    if (policy.syncDue) {
      duePolicies += 1;
    }
  }

  return {
    totalPolicies: policies.length,
    enabledPolicies,
    disabledPolicies,
    autoSyncEnabledPolicies,
    autoEscalateEnabledPolicies,
    autoRemediationEnabledPolicies: countGatewayAnalysisAutoRemediationEnabledPolicies(policies),
    alertingEnabledPolicies,
    duePolicies,
    byStatus: toBuckets(byStatus),
    bySyncStatus: toBuckets(bySyncStatus),
  };
}
