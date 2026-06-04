import type {
  GatewayRateLimitHotspotFilterView,
  GatewayRateLimitHotspotMetricSummaryView,
  GatewayRateLimitHotspotTrendPointView,
  GatewayRateLimitHotspotTrendReportView,
  GatewayRateLimitHotspotTrendSummaryView,
  GatewayRequestAuditView,
  GatewaySummaryBucket,
} from "@neuro/contracts";

import { buildGatewayRateLimitHotspotSummary } from "./rate-limit-hotspot";

function toTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRateLimitRow(row: GatewayRequestAuditView) {
  const code = row.routeTrace?.errorCode?.trim().toLowerCase() ?? "";
  return code.startsWith("rate_limit_exceeded") || code.startsWith("rate-limit");
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

function topBucketShare(buckets: GatewaySummaryBucket[], total: number) {
  const count = buckets[0]?.count ?? null;
  if (count == null || total <= 0) {
    return null;
  }
  return count / total;
}

function buildTrendSummary(points: GatewayRateLimitHotspotTrendPointView[]): GatewayRateLimitHotspotTrendSummaryView | null {
  const latest = points[0] ?? null;
  if (!latest) {
    return null;
  }
  const previous = points[1] ?? null;
  return {
    latestBucketStartAt: latest.bucketStartAt,
    previousBucketStartAt: previous?.bucketStartAt ?? null,
    totalRateLimitedRequests: buildMetricSummary(
      latest.totalRateLimitedRequests,
      previous?.totalRateLimitedRequests ?? null,
    ),
    topCodeShare: buildMetricSummary(
      topBucketShare(latest.byCode, latest.totalRateLimitedRequests),
      previous ? topBucketShare(previous.byCode, previous.totalRateLimitedRequests) : null,
    ),
    topProjectShare: buildMetricSummary(
      topBucketShare(latest.byProject, latest.totalRateLimitedRequests),
      previous ? topBucketShare(previous.byProject, previous.totalRateLimitedRequests) : null,
    ),
    topApiKeyShare: buildMetricSummary(
      topBucketShare(latest.byApiKeyId, latest.totalRateLimitedRequests),
      previous ? topBucketShare(previous.byApiKeyId, previous.totalRateLimitedRequests) : null,
    ),
    topRequestedModelShare: buildMetricSummary(
      topBucketShare(latest.byRequestedModel, latest.totalRateLimitedRequests),
      previous ? topBucketShare(previous.byRequestedModel, previous.totalRateLimitedRequests) : null,
    ),
    topEndpointShare: buildMetricSummary(
      topBucketShare(latest.byEndpointKind, latest.totalRateLimitedRequests),
      previous ? topBucketShare(previous.byEndpointKind, previous.totalRateLimitedRequests) : null,
    ),
    latestTopCodeKey: latest.byCode[0]?.key ?? null,
    latestTopProjectKey: latest.byProject[0]?.key ?? null,
    latestTopApiKeyKey: latest.byApiKeyId[0]?.key ?? null,
    latestTopRequestedModelKey: latest.byRequestedModel[0]?.key ?? null,
    latestTopEndpointKey: latest.byEndpointKind[0]?.key ?? null,
  };
}

export function buildGatewayRateLimitHotspotTrendReport(args: {
  generatedAt: string;
  filters: GatewayRateLimitHotspotFilterView;
  rows: GatewayRequestAuditView[];
}): GatewayRateLimitHotspotTrendReportView {
  const rateLimitRows = args.rows.filter(isRateLimitRow);
  const bucketSizeMinutes = Math.max(1, args.filters.bucketSizeMinutes);
  const windowSize = Math.max(1, args.filters.windowSize);
  const bucketSizeMs = bucketSizeMinutes * 60 * 1000;
  const timestamps = rateLimitRows
    .map((row) => toTimestamp(row.createdAt))
    .filter((value): value is number => value != null);
  const anchor = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
  const latestBucketStart = Math.floor(anchor / bucketSizeMs) * bucketSizeMs;
  const points: GatewayRateLimitHotspotTrendPointView[] = [];

  for (let index = 0; index < windowSize; index += 1) {
    const bucketStartMs = latestBucketStart - index * bucketSizeMs;
    const bucketEndMs = bucketStartMs + bucketSizeMs;
    const bucketRows = rateLimitRows.filter((row) => {
      const timestamp = toTimestamp(row.createdAt);
      return timestamp != null && timestamp >= bucketStartMs && timestamp < bucketEndMs;
    });
    const summary = buildGatewayRateLimitHotspotSummary(bucketRows);
    points.push({
      bucketStartAt: new Date(bucketStartMs).toISOString(),
      bucketEndAt: new Date(bucketEndMs).toISOString(),
      totalRateLimitedRequests: summary.totalRateLimitedRequests,
      byCode: summary.byCode,
      byProject: summary.byProject,
      byRoutePolicyId: summary.byRoutePolicyId,
      byApiKeyId: summary.byApiKeyId,
      byRequestedModel: summary.byRequestedModel,
      byResolvedModel: summary.byResolvedModel,
      byEndpointKind: summary.byEndpointKind,
    });
  }

  return {
    generatedAt: args.generatedAt,
    filters: args.filters,
    matchedRequestsCount: rateLimitRows.length,
    windowSize,
    bucketSizeMinutes,
    points,
    summary: buildTrendSummary(points),
  };
}
