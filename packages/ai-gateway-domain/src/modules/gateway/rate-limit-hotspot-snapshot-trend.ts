import type {
  GatewayRateLimitHotspotMetricSummaryView,
  GatewayRateLimitHotspotSnapshotReportFilterView,
  GatewayRateLimitHotspotSnapshotInventorySummaryView,
  GatewayRateLimitHotspotSnapshotTrendPointView,
  GatewayRateLimitHotspotSnapshotTrendReportView,
  GatewayRateLimitHotspotSnapshotTrendSummaryView,
  GatewayRateLimitHotspotSnapshotView,
  GatewaySummaryBucket,
} from "@neuro/contracts";

function topBucketShare(buckets: GatewaySummaryBucket[], total: number) {
  const count = buckets[0]?.count ?? null;
  if (count == null || total <= 0) {
    return null;
  }
  return count / total;
}

function buildMetricSummary(latestValue: number | null, previousValue: number | null): GatewayRateLimitHotspotMetricSummaryView {
  const deltaValue =
    typeof latestValue === "number" && typeof previousValue === "number" ? latestValue - previousValue : null;
  const deltaRatio =
    typeof latestValue === "number" &&
    typeof previousValue === "number" &&
    previousValue !== 0 &&
    deltaValue != null
      ? deltaValue / previousValue
      : null;
  return {
    latestValue,
    previousValue,
    deltaValue,
    deltaRatio,
  };
}

export function buildGatewayRateLimitHotspotSnapshotTrendPoint(
  snapshot: GatewayRateLimitHotspotSnapshotView,
): GatewayRateLimitHotspotSnapshotTrendPointView {
  const total = snapshot.summary.totalRateLimitedRequests;
  return {
    snapshot,
    totalRateLimitedRequests: total,
    topCodeShare: topBucketShare(snapshot.summary.byCode, total),
    topProjectShare: topBucketShare(snapshot.summary.byProject, total),
    topApiKeyShare: topBucketShare(snapshot.summary.byApiKeyId, total),
    topRequestedModelShare: topBucketShare(snapshot.summary.byRequestedModel, total),
    topEndpointShare: topBucketShare(snapshot.summary.byEndpointKind, total),
  };
}

function buildTrendSummary(points: GatewayRateLimitHotspotSnapshotTrendPointView[]): GatewayRateLimitHotspotSnapshotTrendSummaryView | null {
  const latest = points[0] ?? null;
  if (!latest) {
    return null;
  }
  const previous = points[1] ?? null;
  return {
    latestSnapshotId: latest.snapshot.snapshotId,
    previousSnapshotId: previous?.snapshot.snapshotId ?? null,
    totalRateLimitedRequests: buildMetricSummary(
      latest.totalRateLimitedRequests,
      previous?.totalRateLimitedRequests ?? null,
    ),
    topCodeShare: buildMetricSummary(latest.topCodeShare, previous?.topCodeShare ?? null),
    topProjectShare: buildMetricSummary(latest.topProjectShare, previous?.topProjectShare ?? null),
    topApiKeyShare: buildMetricSummary(latest.topApiKeyShare, previous?.topApiKeyShare ?? null),
    topRequestedModelShare: buildMetricSummary(
      latest.topRequestedModelShare,
      previous?.topRequestedModelShare ?? null,
    ),
    topEndpointShare: buildMetricSummary(latest.topEndpointShare, previous?.topEndpointShare ?? null),
  };
}

export function buildGatewayRateLimitHotspotSnapshotTrendReport(args: {
  generatedAt: string;
  filters: GatewayRateLimitHotspotSnapshotReportFilterView;
  windowSize: number;
  inventorySummary: GatewayRateLimitHotspotSnapshotInventorySummaryView;
  points: GatewayRateLimitHotspotSnapshotTrendPointView[];
}): GatewayRateLimitHotspotSnapshotTrendReportView {
  return {
    generatedAt: args.generatedAt,
    filters: args.filters,
    matchedSnapshotsCount: args.points.length,
    windowSize: args.windowSize,
    inventorySummary: args.inventorySummary,
    points: args.points,
    summary: buildTrendSummary(args.points),
  };
}
