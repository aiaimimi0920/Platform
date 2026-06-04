import type { GatewayRateLimitHotspotSummaryView, GatewayRequestAuditView, GatewaySummaryBucket } from "@neuro/contracts";

function accumulateSummaryBucket(map: Map<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() ?? "";
  if (!normalized) {
    return;
  }
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toSummaryBuckets(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count } satisfies GatewaySummaryBucket))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function isRateLimitErrorCode(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.startsWith("rate_limit_exceeded") || normalized.startsWith("rate-limit");
}

export function buildGatewayRateLimitHotspotSummary(rows: GatewayRequestAuditView[]): GatewayRateLimitHotspotSummaryView {
  const byCode = new Map<string, number>();
  const byRoutePolicyId = new Map<string, number>();
  const byApiKeyId = new Map<string, number>();
  const byRequestedModel = new Map<string, number>();
  const byResolvedModel = new Map<string, number>();
  const byEndpointKind = new Map<string, number>();
  const byProjectId = new Map<string, number>();
  let totalRateLimitedRequests = 0;

  for (const row of rows) {
    const code = row.routeTrace?.errorCode;
    if (!isRateLimitErrorCode(code)) {
      continue;
    }
    totalRateLimitedRequests += 1;
    accumulateSummaryBucket(byCode, code);
    accumulateSummaryBucket(byRoutePolicyId, row.routePolicyId);
    accumulateSummaryBucket(byApiKeyId, row.apiKeyId);
    accumulateSummaryBucket(byRequestedModel, row.requestedModel);
    accumulateSummaryBucket(byResolvedModel, row.resolvedModel);
    accumulateSummaryBucket(byEndpointKind, row.endpointKind);
    accumulateSummaryBucket(byProjectId, row.projectId);
  }

  return {
    totalRateLimitedRequests,
    byCode: toSummaryBuckets(byCode),
    byProject: toSummaryBuckets(byProjectId),
    byRoutePolicyId: toSummaryBuckets(byRoutePolicyId),
    byApiKeyId: toSummaryBuckets(byApiKeyId),
    byRequestedModel: toSummaryBuckets(byRequestedModel),
    byResolvedModel: toSummaryBuckets(byResolvedModel),
    byEndpointKind: toSummaryBuckets(byEndpointKind),
  } satisfies GatewayRateLimitHotspotSummaryView;
}
