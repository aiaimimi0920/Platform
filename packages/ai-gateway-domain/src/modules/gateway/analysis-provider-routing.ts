import type {
  GatewayAnalysisExportAnomalyProfileKey,
  GatewayAnalysisExportAnomalySeverity,
  GatewayAnalysisMetricDistributionView,
  GatewayAnalysisSampleView,
  GatewayProviderRoutingAnalysisAnomalyCode,
  GatewayProviderRoutingAnalysisAnomalyReportView,
  GatewayProviderRoutingAnalysisAnomalyThresholdConfig,
  GatewayProviderRoutingAnalysisAnomalyView,
  GatewayProviderRoutingAnalysisFilterView,
  GatewayProviderRoutingAnalysisSummaryView,
  GatewaySummaryBucket,
} from "@neuro/contracts";

function toBuckets(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count } satisfies GatewaySummaryBucket))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function buildDistribution(values: Array<number | null | undefined>): GatewayAnalysisMetricDistributionView {
  const normalized = values
    .map((value) => (typeof value === "number" && Number.isFinite(value) ? value : null))
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right);

  if (normalized.length === 0) {
    return {
      avg: null,
      p50: null,
      p95: null,
    };
  }

  const average = normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
  const readPercentile = (percentile: number) => {
    const index = Math.min(
      normalized.length - 1,
      Math.max(0, Math.ceil((percentile / 100) * normalized.length) - 1),
    );
    return normalized[index] ?? null;
  };

  return {
    avg: Math.round(average * 1000) / 1000,
    p50: readPercentile(50),
    p95: readPercentile(95),
  };
}

function pushBucket(map: Map<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() ?? "";
  if (!normalized) {
    return;
  }
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

export function buildGatewayProviderRoutingAnalysisSummary(
  rows: GatewayAnalysisSampleView[],
): GatewayProviderRoutingAnalysisSummaryView {
  const bySelectedProvider = new Map<string, number>();
  const byDegradationReason = new Map<string, number>();
  let selectedProviderSamples = 0;
  let degradedSelectedProviderSamples = 0;
  let saturatedSelectedProviderSamples = 0;
  let breakerOpenSelectedProviderSamples = 0;

  const routingScores: Array<number | null> = [];
  const healthWeights: Array<number | null> = [];
  const capacityWeights: Array<number | null> = [];

  for (const row of rows) {
    const selected = row.routeTrace?.selectedCandidate ?? null;
    if (!selected) {
      continue;
    }
    selectedProviderSamples += 1;
    pushBucket(bySelectedProvider, selected.providerAccountId);
    routingScores.push(selected.routingScore ?? null);
    healthWeights.push(selected.healthWeight ?? null);
    capacityWeights.push(selected.capacityWeight ?? null);

    if (selected.degraded) {
      degradedSelectedProviderSamples += 1;
    }
    if (selected.breakerOpen) {
      breakerOpenSelectedProviderSamples += 1;
    }
    if ((selected.capacityWeight ?? 1) <= 0) {
      saturatedSelectedProviderSamples += 1;
    }
    for (const reason of selected.degradationReasons ?? []) {
      pushBucket(byDegradationReason, reason);
    }
  }

  return {
    totalSamples: rows.length,
    selectedProviderSamples,
    degradedSelectedProviderSamples,
    saturatedSelectedProviderSamples,
    breakerOpenSelectedProviderSamples,
    routingScore: buildDistribution(routingScores),
    healthWeight: buildDistribution(healthWeights),
    capacityWeight: buildDistribution(capacityWeights),
    bySelectedProvider: toBuckets(bySelectedProvider),
    byDegradationReason: toBuckets(byDegradationReason),
  };
}

export function buildGatewayProviderRoutingAnalysisAnomalyThresholdConfig(
  profileKey: GatewayAnalysisExportAnomalyProfileKey,
  overrides: Partial<GatewayProviderRoutingAnalysisAnomalyThresholdConfig> = {},
): GatewayProviderRoutingAnalysisAnomalyThresholdConfig {
  const base =
    profileKey === "conservative"
      ? {
          routingScoreWarningThreshold: 0.45,
          routingScoreCriticalThreshold: 0.25,
          degradedRouteWarningThreshold: 0.4,
          degradedRouteCriticalThreshold: 0.65,
          saturatedRouteWarningThreshold: 0.15,
          saturatedRouteCriticalThreshold: 0.3,
          breakerOpenRouteWarningThreshold: 0.05,
          breakerOpenRouteCriticalThreshold: 0.15,
        }
      : profileKey === "aggressive"
        ? {
            routingScoreWarningThreshold: 0.65,
            routingScoreCriticalThreshold: 0.45,
            degradedRouteWarningThreshold: 0.2,
            degradedRouteCriticalThreshold: 0.4,
            saturatedRouteWarningThreshold: 0.05,
            saturatedRouteCriticalThreshold: 0.15,
            breakerOpenRouteWarningThreshold: 0.01,
            breakerOpenRouteCriticalThreshold: 0.05,
          }
        : {
            routingScoreWarningThreshold: 0.55,
            routingScoreCriticalThreshold: 0.35,
            degradedRouteWarningThreshold: 0.3,
            degradedRouteCriticalThreshold: 0.55,
            saturatedRouteWarningThreshold: 0.1,
            saturatedRouteCriticalThreshold: 0.2,
            breakerOpenRouteWarningThreshold: 0.02,
            breakerOpenRouteCriticalThreshold: 0.08,
          };
  return {
    ...base,
    ...overrides,
  };
}

function pushAnomaly(args: {
  anomalies: GatewayProviderRoutingAnalysisAnomalyView[];
  code: GatewayProviderRoutingAnalysisAnomalyCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  message: string;
  latestValue: number | null;
  thresholdValue: number | null;
}) {
  args.anomalies.push({
    code: args.code,
    severity: args.severity,
    message: args.message,
    latestValue: args.latestValue,
    previousValue: null,
    deltaValue: null,
    deltaRatio: null,
    thresholdValue: args.thresholdValue,
  });
}

export function buildGatewayProviderRoutingAnalysisAnomalyReport(args: {
  generatedAt: string;
  filters: GatewayProviderRoutingAnalysisFilterView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayProviderRoutingAnalysisAnomalyThresholdConfig;
  summary: GatewayProviderRoutingAnalysisSummaryView;
}): GatewayProviderRoutingAnalysisAnomalyReportView {
  const anomalies: GatewayProviderRoutingAnalysisAnomalyView[] = [];
  const bySeverity = new Map<string, number>();
  const byCode = new Map<string, number>();

  const selectedSamples = Math.max(1, args.summary.selectedProviderSamples);
  const degradedRate = args.summary.degradedSelectedProviderSamples / selectedSamples;
  const saturatedRate = args.summary.saturatedSelectedProviderSamples / selectedSamples;
  const breakerOpenRate = args.summary.breakerOpenSelectedProviderSamples / selectedSamples;
  const routingScoreAvg = args.summary.routingScore.avg ?? null;

  if (routingScoreAvg != null && routingScoreAvg <= args.thresholds.routingScoreWarningThreshold) {
    pushAnomaly({
      anomalies,
      code: "provider_routing_score_drop",
      severity:
        routingScoreAvg <= args.thresholds.routingScoreCriticalThreshold ? "critical" : "warning",
      message: "当前窗口内被选中 provider 的平均 routing score 明显偏低，说明选路正在持续踩到退化节点。",
      latestValue: routingScoreAvg,
      thresholdValue: args.thresholds.routingScoreWarningThreshold,
    });
  }

  if (degradedRate >= args.thresholds.degradedRouteWarningThreshold) {
    pushAnomaly({
      anomalies,
      code: "degraded_provider_route_spike",
      severity:
        degradedRate >= args.thresholds.degradedRouteCriticalThreshold ? "critical" : "warning",
      message: "当前窗口内命中 degraded provider 的请求占比过高。",
      latestValue: Math.round(degradedRate * 1000) / 1000,
      thresholdValue: args.thresholds.degradedRouteWarningThreshold,
    });
  }

  if (saturatedRate >= args.thresholds.saturatedRouteWarningThreshold) {
    pushAnomaly({
      anomalies,
      code: "saturated_provider_route_spike",
      severity:
        saturatedRate >= args.thresholds.saturatedRouteCriticalThreshold ? "critical" : "warning",
      message: "当前窗口内命中并发饱和 provider 的请求占比过高。",
      latestValue: Math.round(saturatedRate * 1000) / 1000,
      thresholdValue: args.thresholds.saturatedRouteWarningThreshold,
    });
  }

  if (breakerOpenRate >= args.thresholds.breakerOpenRouteWarningThreshold) {
    pushAnomaly({
      anomalies,
      code: "breaker_open_provider_route_detected",
      severity:
        breakerOpenRate >= args.thresholds.breakerOpenRouteCriticalThreshold ? "critical" : "warning",
      message: "当前窗口内仍有请求命中 breaker-open provider，说明 routing 健康退避仍存在裂口。",
      latestValue: Math.round(breakerOpenRate * 1000) / 1000,
      thresholdValue: args.thresholds.breakerOpenRouteWarningThreshold,
    });
  }

  for (const anomaly of anomalies) {
    pushBucket(bySeverity, anomaly.severity);
    pushBucket(byCode, anomaly.code);
  }

  return {
    generatedAt: args.generatedAt,
    filters: args.filters,
    profileKey: args.profileKey,
    thresholds: args.thresholds,
    summary: args.summary,
    anomalies,
    bySeverity: toBuckets(bySeverity),
    byCode: toBuckets(byCode),
  };
}
