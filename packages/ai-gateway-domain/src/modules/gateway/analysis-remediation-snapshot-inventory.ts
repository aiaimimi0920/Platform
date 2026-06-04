import type {
  GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView,
  GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView,
  GatewaySummaryBucket,
} from "@neuro/contracts";

function accumulateBucket(map: Map<string, number>, key: string | null | undefined) {
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

export function buildGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummary(args: {
  snapshots: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView[];
}): GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView {
  const byRoutePolicyId = new Map<string, number>();
  const byActionKey = new Map<string, number>();
  const byExecutionMode = new Map<string, number>();
  const byLabel = new Map<string, number>();

  let totalRuns = 0;
  let totalImpactedRuns = 0;
  let totalUnavailableRuns = 0;

  for (const snapshot of args.snapshots) {
    totalRuns += snapshot.summary.totalRuns;
    totalImpactedRuns += snapshot.summary.impactedRuns;
    totalUnavailableRuns += snapshot.summary.unavailableRuns;
    accumulateBucket(byRoutePolicyId, snapshot.filters.routePolicyId);
    accumulateBucket(byActionKey, snapshot.filters.actionKey);
    accumulateBucket(byExecutionMode, snapshot.filters.executionMode);
    accumulateBucket(byLabel, snapshot.label);
  }

  return {
    totalSnapshots: args.snapshots.length,
    totalRuns,
    totalImpactedRuns,
    totalUnavailableRuns,
    byRoutePolicyId: toBuckets(byRoutePolicyId),
    byActionKey: toBuckets(byActionKey),
    byExecutionMode: toBuckets(byExecutionMode),
    byLabel: toBuckets(byLabel),
  };
}
