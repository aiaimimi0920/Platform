import type {
  GatewayRateLimitHotspotSnapshotInventorySummaryView,
  GatewayRateLimitHotspotSnapshotView,
  GatewaySummaryBucket,
} from "@neuro/contracts";

function pushBucket(map: Map<string, number>, key: string | null | undefined, count: number) {
  const normalized = key?.trim() ?? "";
  if (!normalized || count <= 0) {
    return;
  }
  map.set(normalized, (map.get(normalized) ?? 0) + count);
}

function mergeBuckets(target: Map<string, number>, buckets: GatewaySummaryBucket[]) {
  for (const bucket of buckets) {
    pushBucket(target, bucket.key, bucket.count);
  }
}

function toBuckets(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count } satisfies GatewaySummaryBucket))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function buildGatewayRateLimitHotspotSnapshotInventorySummary(args: {
  snapshots: GatewayRateLimitHotspotSnapshotView[];
}): GatewayRateLimitHotspotSnapshotInventorySummaryView {
  const byCode = new Map<string, number>();
  const byProject = new Map<string, number>();
  const byRoutePolicyId = new Map<string, number>();
  const byApiKeyId = new Map<string, number>();
  const byRequestedModel = new Map<string, number>();
  const byResolvedModel = new Map<string, number>();
  const byEndpointKind = new Map<string, number>();
  const byLabel = new Map<string, number>();
  let totalRateLimitedRequests = 0;

  for (const snapshot of args.snapshots) {
    totalRateLimitedRequests += snapshot.summary.totalRateLimitedRequests;
    mergeBuckets(byCode, snapshot.summary.byCode);
    mergeBuckets(byProject, snapshot.summary.byProject);
    mergeBuckets(byRoutePolicyId, snapshot.summary.byRoutePolicyId);
    mergeBuckets(byApiKeyId, snapshot.summary.byApiKeyId);
    mergeBuckets(byRequestedModel, snapshot.summary.byRequestedModel);
    mergeBuckets(byResolvedModel, snapshot.summary.byResolvedModel);
    mergeBuckets(byEndpointKind, snapshot.summary.byEndpointKind);
    pushBucket(byLabel, snapshot.label, 1);
  }

  return {
    totalSnapshots: args.snapshots.length,
    totalRateLimitedRequests,
    byCode: toBuckets(byCode),
    byProject: toBuckets(byProject),
    byRoutePolicyId: toBuckets(byRoutePolicyId),
    byApiKeyId: toBuckets(byApiKeyId),
    byRequestedModel: toBuckets(byRequestedModel),
    byResolvedModel: toBuckets(byResolvedModel),
    byEndpointKind: toBuckets(byEndpointKind),
    byLabel: toBuckets(byLabel),
  };
}
