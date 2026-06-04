import type {
  GatewayAnalysisExportAnomalyProfileKey,
  GatewayAnalysisExportAnomalySeverity,
  GatewayRateLimitHotspotAnomalyCode,
  GatewayRateLimitHotspotAnomalyReportView,
  GatewayRateLimitHotspotAnomalyThresholdConfig,
  GatewayRateLimitHotspotAnomalyView,
  GatewayRateLimitHotspotTrendReportView,
  GatewaySummaryBucket,
} from "@neuro/contracts";

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

export function buildGatewayRateLimitHotspotAnomalyThresholdConfig(
  profileKey: GatewayAnalysisExportAnomalyProfileKey,
  overrides: Partial<GatewayRateLimitHotspotAnomalyThresholdConfig> = {},
): GatewayRateLimitHotspotAnomalyThresholdConfig {
  const base =
    profileKey === "conservative"
      ? {
          totalRateLimitedRequestsWarningThreshold: 25,
          totalRateLimitedRequestsCriticalThreshold: 60,
          totalRateLimitedRequestsDeltaRatioThreshold: 0.5,
          topCodeShareWarningThreshold: 0.55,
          topCodeShareCriticalThreshold: 0.7,
          topProjectShareWarningThreshold: 0.45,
          topProjectShareCriticalThreshold: 0.6,
          topApiKeyShareWarningThreshold: 0.4,
          topApiKeyShareCriticalThreshold: 0.55,
          topRequestedModelShareWarningThreshold: 0.45,
          topRequestedModelShareCriticalThreshold: 0.6,
          topEndpointShareWarningThreshold: 0.6,
          topEndpointShareCriticalThreshold: 0.8,
        }
      : profileKey === "aggressive"
        ? {
            totalRateLimitedRequestsWarningThreshold: 8,
            totalRateLimitedRequestsCriticalThreshold: 20,
            totalRateLimitedRequestsDeltaRatioThreshold: 0.2,
            topCodeShareWarningThreshold: 0.35,
            topCodeShareCriticalThreshold: 0.5,
            topProjectShareWarningThreshold: 0.3,
            topProjectShareCriticalThreshold: 0.45,
            topApiKeyShareWarningThreshold: 0.25,
            topApiKeyShareCriticalThreshold: 0.4,
            topRequestedModelShareWarningThreshold: 0.3,
            topRequestedModelShareCriticalThreshold: 0.45,
            topEndpointShareWarningThreshold: 0.45,
            topEndpointShareCriticalThreshold: 0.65,
          }
        : {
            totalRateLimitedRequestsWarningThreshold: 15,
            totalRateLimitedRequestsCriticalThreshold: 35,
            totalRateLimitedRequestsDeltaRatioThreshold: 0.35,
            topCodeShareWarningThreshold: 0.45,
            topCodeShareCriticalThreshold: 0.6,
            topProjectShareWarningThreshold: 0.35,
            topProjectShareCriticalThreshold: 0.5,
            topApiKeyShareWarningThreshold: 0.3,
            topApiKeyShareCriticalThreshold: 0.45,
            topRequestedModelShareWarningThreshold: 0.35,
            topRequestedModelShareCriticalThreshold: 0.5,
            topEndpointShareWarningThreshold: 0.5,
            topEndpointShareCriticalThreshold: 0.7,
          };

  return {
    ...base,
    ...overrides,
  };
}

function pushAnomaly(args: {
  anomalies: GatewayRateLimitHotspotAnomalyView[];
  code: GatewayRateLimitHotspotAnomalyCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  message: string;
  entityKey?: string | null;
  latestBucketStartAt: string | null;
  previousBucketStartAt: string | null;
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
  thresholdValue: number;
}) {
  args.anomalies.push({
    code: args.code,
    severity: args.severity,
    message: args.message,
    entityKey: args.entityKey ?? null,
    latestBucketStartAt: args.latestBucketStartAt,
    previousBucketStartAt: args.previousBucketStartAt,
    latestValue: args.latestValue,
    previousValue: args.previousValue,
    deltaValue: args.deltaValue,
    deltaRatio: args.deltaRatio,
    thresholdValue: args.thresholdValue,
  });
}

export function buildGatewayRateLimitHotspotAnomalyReport(args: {
  generatedAt: string;
  trendReport: GatewayRateLimitHotspotTrendReportView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayRateLimitHotspotAnomalyThresholdConfig;
}): GatewayRateLimitHotspotAnomalyReportView {
  const anomalies: GatewayRateLimitHotspotAnomalyView[] = [];
  const bySeverity = new Map<string, number>();
  const byCode = new Map<string, number>();
  const summary = args.trendReport.summary;
  const latestPoint = args.trendReport.points[0] ?? null;
  const previousPoint = args.trendReport.points[1] ?? null;

  if (summary) {
    const totalLatest = summary.totalRateLimitedRequests.latestValue ?? 0;
    const totalCritical =
      totalLatest >= args.thresholds.totalRateLimitedRequestsCriticalThreshold &&
      (summary.totalRateLimitedRequests.deltaRatio == null ||
        summary.totalRateLimitedRequests.deltaRatio >= args.thresholds.totalRateLimitedRequestsDeltaRatioThreshold);
    const totalWarning =
      totalLatest >= args.thresholds.totalRateLimitedRequestsWarningThreshold &&
      (summary.totalRateLimitedRequests.deltaRatio == null ||
        summary.totalRateLimitedRequests.deltaRatio >= args.thresholds.totalRateLimitedRequestsDeltaRatioThreshold);
    if (totalWarning) {
      pushAnomaly({
        anomalies,
        code: "rate_limit_request_spike",
        severity: totalCritical ? "critical" : "warning",
        message: "当前时间桶内的 rate-limit 请求量明显升高，热点流量正在打穿当前限流策略。",
        latestBucketStartAt: summary.latestBucketStartAt,
        previousBucketStartAt: summary.previousBucketStartAt,
        latestValue: summary.totalRateLimitedRequests.latestValue,
        previousValue: summary.totalRateLimitedRequests.previousValue,
        deltaValue: summary.totalRateLimitedRequests.deltaValue,
        deltaRatio: summary.totalRateLimitedRequests.deltaRatio,
        thresholdValue: args.thresholds.totalRateLimitedRequestsWarningThreshold,
      });
    }

    const shareChecks: Array<{
      code: GatewayRateLimitHotspotAnomalyCode;
      latestValue: number | null;
      previousValue: number | null;
      deltaValue: number | null;
      deltaRatio: number | null;
      warningThreshold: number;
      criticalThreshold: number;
      entityKey: string | null;
      message: string;
    }> = [
      {
        code: "rate_limit_code_concentration",
        latestValue: summary.topCodeShare.latestValue,
        previousValue: summary.topCodeShare.previousValue,
        deltaValue: summary.topCodeShare.deltaValue,
        deltaRatio: summary.topCodeShare.deltaRatio,
        warningThreshold: args.thresholds.topCodeShareWarningThreshold,
        criticalThreshold: args.thresholds.topCodeShareCriticalThreshold,
        entityKey: summary.latestTopCodeKey,
        message: "单一 rate-limit 错误码占比过高，说明当前热点已经集中在同一类限流路径。",
      },
      {
        code: "rate_limit_project_hotspot",
        latestValue: summary.topProjectShare.latestValue,
        previousValue: summary.topProjectShare.previousValue,
        deltaValue: summary.topProjectShare.deltaValue,
        deltaRatio: summary.topProjectShare.deltaRatio,
        warningThreshold: args.thresholds.topProjectShareWarningThreshold,
        criticalThreshold: args.thresholds.topProjectShareCriticalThreshold,
        entityKey: summary.latestTopProjectKey,
        message: "单一 project 的 rate-limit 占比过高，当前热点已经明显集中在特定 project。",
      },
      {
        code: "rate_limit_api_key_hotspot",
        latestValue: summary.topApiKeyShare.latestValue,
        previousValue: summary.topApiKeyShare.previousValue,
        deltaValue: summary.topApiKeyShare.deltaValue,
        deltaRatio: summary.topApiKeyShare.deltaRatio,
        warningThreshold: args.thresholds.topApiKeyShareWarningThreshold,
        criticalThreshold: args.thresholds.topApiKeyShareCriticalThreshold,
        entityKey: summary.latestTopApiKeyKey,
        message: "单一 API key 的 rate-limit 占比过高，当前热点已经集中到单个 key。",
      },
      {
        code: "rate_limit_model_hotspot",
        latestValue: summary.topRequestedModelShare.latestValue,
        previousValue: summary.topRequestedModelShare.previousValue,
        deltaValue: summary.topRequestedModelShare.deltaValue,
        deltaRatio: summary.topRequestedModelShare.deltaRatio,
        warningThreshold: args.thresholds.topRequestedModelShareWarningThreshold,
        criticalThreshold: args.thresholds.topRequestedModelShareCriticalThreshold,
        entityKey: summary.latestTopRequestedModelKey,
        message: "单一模型的 rate-limit 占比过高，当前热点已经集中在同一个模型请求面。",
      },
      {
        code: "rate_limit_endpoint_hotspot",
        latestValue: summary.topEndpointShare.latestValue,
        previousValue: summary.topEndpointShare.previousValue,
        deltaValue: summary.topEndpointShare.deltaValue,
        deltaRatio: summary.topEndpointShare.deltaRatio,
        warningThreshold: args.thresholds.topEndpointShareWarningThreshold,
        criticalThreshold: args.thresholds.topEndpointShareCriticalThreshold,
        entityKey: summary.latestTopEndpointKey,
        message: "单一 endpoint 的 rate-limit 占比过高，当前热点已经集中在同一条公开调用口径。",
      },
    ];

    for (const item of shareChecks) {
      if ((item.latestValue ?? 0) < item.warningThreshold) {
        continue;
      }
      pushAnomaly({
        anomalies,
        code: item.code,
        severity: (item.latestValue ?? 0) >= item.criticalThreshold ? "critical" : "warning",
        message: item.message,
        entityKey: item.entityKey,
        latestBucketStartAt: summary.latestBucketStartAt,
        previousBucketStartAt: summary.previousBucketStartAt,
        latestValue: item.latestValue,
        previousValue: item.previousValue,
        deltaValue: item.deltaValue,
        deltaRatio: item.deltaRatio,
        thresholdValue: item.warningThreshold,
      });
    }
  }

  for (const anomaly of anomalies) {
    pushBucket(bySeverity, anomaly.severity);
    pushBucket(byCode, anomaly.code);
  }

  return {
    generatedAt: args.generatedAt,
    filters: args.trendReport.filters,
    profileKey: args.profileKey,
    thresholds: args.thresholds,
    trendSummary: args.trendReport.summary,
    latestPoint,
    previousPoint,
    anomalies,
    bySeverity: toBuckets(bySeverity),
    byCode: toBuckets(byCode),
  };
}
