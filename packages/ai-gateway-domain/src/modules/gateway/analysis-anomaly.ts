import type {
  GatewayAnalysisExportAnomalyCode,
  GatewayAnalysisExportAnomalyProfileKey,
  GatewayAnalysisExportAnomalyReportView,
  GatewayAnalysisExportAnomalySeverity,
  GatewayAnalysisExportAnomalyThresholdConfig,
  GatewayAnalysisExportAnomalyView,
  GatewayAnalysisExportTrendMetricSummaryView,
  GatewayAnalysisExportTrendReportView,
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

export function buildGatewayAnalysisExportAnomalyThresholdConfig(
  profileKey: GatewayAnalysisExportAnomalyProfileKey,
  overrides: Partial<GatewayAnalysisExportAnomalyThresholdConfig> = {},
): GatewayAnalysisExportAnomalyThresholdConfig {
  const base: GatewayAnalysisExportAnomalyThresholdConfig =
    profileKey === "conservative"
      ? {
          failureRateWarningThreshold: 0.2,
          failureRateCriticalThreshold: 0.3,
          failureRateDeltaRatioThreshold: 0.8,
          completionRateWarningThreshold: 0.7,
          completionRateCriticalThreshold: 0.55,
          completionRateDeltaValueThreshold: -0.15,
          responseArtifactCoverageWarningThreshold: 0.75,
          responseArtifactCoverageCriticalThreshold: 0.55,
          responseArtifactCoverageDeltaValueThreshold: -0.15,
          requestArtifactCoverageWarningThreshold: 0.8,
          requestArtifactCoverageCriticalThreshold: 0.6,
          requestArtifactCoverageDeltaValueThreshold: -0.15,
          tokensPerSampleWarningDeltaRatioThreshold: 0.5,
          tokensPerSampleCriticalDeltaRatioThreshold: 1,
          tokensPerSampleCriticalAbsoluteThreshold: 2500,
        }
      : profileKey === "aggressive"
        ? {
            failureRateWarningThreshold: 0.12,
            failureRateCriticalThreshold: 0.2,
            failureRateDeltaRatioThreshold: 0.35,
            completionRateWarningThreshold: 0.8,
            completionRateCriticalThreshold: 0.7,
            completionRateDeltaValueThreshold: -0.08,
            responseArtifactCoverageWarningThreshold: 0.85,
            responseArtifactCoverageCriticalThreshold: 0.7,
            responseArtifactCoverageDeltaValueThreshold: -0.08,
            requestArtifactCoverageWarningThreshold: 0.9,
            requestArtifactCoverageCriticalThreshold: 0.75,
            requestArtifactCoverageDeltaValueThreshold: -0.08,
            tokensPerSampleWarningDeltaRatioThreshold: 0.25,
            tokensPerSampleCriticalDeltaRatioThreshold: 0.6,
            tokensPerSampleCriticalAbsoluteThreshold: 1800,
          }
        : {
            failureRateWarningThreshold: 0.15,
            failureRateCriticalThreshold: 0.25,
            failureRateDeltaRatioThreshold: 0.5,
            completionRateWarningThreshold: 0.75,
            completionRateCriticalThreshold: 0.6,
            completionRateDeltaValueThreshold: -0.1,
            responseArtifactCoverageWarningThreshold: 0.8,
            responseArtifactCoverageCriticalThreshold: 0.6,
            responseArtifactCoverageDeltaValueThreshold: -0.1,
            requestArtifactCoverageWarningThreshold: 0.85,
            requestArtifactCoverageCriticalThreshold: 0.65,
            requestArtifactCoverageDeltaValueThreshold: -0.1,
            tokensPerSampleWarningDeltaRatioThreshold: 0.35,
            tokensPerSampleCriticalDeltaRatioThreshold: 0.8,
            tokensPerSampleCriticalAbsoluteThreshold: 2000,
          };

  return {
    ...base,
    ...overrides,
  };
}

function pushMetricAnomaly(args: {
  anomalies: GatewayAnalysisExportAnomalyView[];
  code: GatewayAnalysisExportAnomalyCode;
  message: string;
  severity: GatewayAnalysisExportAnomalySeverity;
  latestExportId: string | null;
  previousExportId: string | null;
  metric: GatewayAnalysisExportTrendMetricSummaryView;
  thresholdValue: number | null;
}) {
  args.anomalies.push({
    code: args.code,
    severity: args.severity,
    message: args.message,
    latestExportId: args.latestExportId,
    previousExportId: args.previousExportId,
    latestValue: args.metric.latestValue,
    previousValue: args.metric.previousValue,
    deltaValue: args.metric.deltaValue,
    deltaRatio: args.metric.deltaRatio,
    thresholdValue: args.thresholdValue,
  });
}

export function buildGatewayAnalysisExportAnomalyReport(args: {
  trendReport: GatewayAnalysisExportTrendReportView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayAnalysisExportAnomalyThresholdConfig;
}): GatewayAnalysisExportAnomalyReportView {
  const anomalies: GatewayAnalysisExportAnomalyView[] = [];
  const latest = args.trendReport.points[0] ?? null;
  const summary = args.trendReport.summary;
  const latestExportId = summary?.latestExportId ?? latest?.export.exportId ?? null;
  const previousExportId = summary?.previousExportId ?? args.trendReport.points[1]?.export.exportId ?? null;

  if (latest && !latest.datasetAvailable) {
    anomalies.push({
      code: "latest_dataset_missing",
      severity: "critical",
      message: "最新一批 export 的 dataset.jsonl 不可用，趋势与基线分析已经失真。",
      latestExportId,
      previousExportId,
      latestValue: null,
      previousValue: null,
      deltaValue: null,
      deltaRatio: null,
      thresholdValue: null,
    });
  }

  if (summary) {
    if (
      (summary.failureRate.latestValue ?? 0) >= args.thresholds.failureRateWarningThreshold ||
      (summary.failureRate.deltaRatio ?? 0) >= args.thresholds.failureRateDeltaRatioThreshold
    ) {
      pushMetricAnomaly({
        anomalies,
        code: "failure_rate_spike",
        message: "失败率相对基线显著升高。",
        severity:
          (summary.failureRate.latestValue ?? 0) >= args.thresholds.failureRateCriticalThreshold
            ? "critical"
            : "warning",
        latestExportId,
        previousExportId,
        metric: summary.failureRate,
        thresholdValue: args.thresholds.failureRateWarningThreshold,
      });
    }

    if (
      (summary.completionRate.deltaValue ?? 0) <= args.thresholds.completionRateDeltaValueThreshold ||
      (summary.completionRate.latestValue ?? 1) <= args.thresholds.completionRateWarningThreshold
    ) {
      pushMetricAnomaly({
        anomalies,
        code: "completion_rate_drop",
        message: "完成率相对基线明显下降。",
        severity:
          (summary.completionRate.latestValue ?? 1) <= args.thresholds.completionRateCriticalThreshold
            ? "critical"
            : "warning",
        latestExportId,
        previousExportId,
        metric: summary.completionRate,
        thresholdValue: args.thresholds.completionRateWarningThreshold,
      });
    }

    if (
      (summary.responseArtifactCoverage.latestValue ?? 1) <= args.thresholds.responseArtifactCoverageWarningThreshold ||
      (summary.responseArtifactCoverage.deltaValue ?? 0) <=
        args.thresholds.responseArtifactCoverageDeltaValueThreshold
    ) {
      pushMetricAnomaly({
        anomalies,
        code: "response_artifact_coverage_drop",
        message: "response artifact 覆盖率低于安全阈值或相对基线明显下降。",
        severity:
          (summary.responseArtifactCoverage.latestValue ?? 1) <=
          args.thresholds.responseArtifactCoverageCriticalThreshold
            ? "critical"
            : "warning",
        latestExportId,
        previousExportId,
        metric: summary.responseArtifactCoverage,
        thresholdValue: args.thresholds.responseArtifactCoverageWarningThreshold,
      });
    }

    if (
      (summary.requestArtifactCoverage.latestValue ?? 1) <= args.thresholds.requestArtifactCoverageWarningThreshold ||
      (summary.requestArtifactCoverage.deltaValue ?? 0) <= args.thresholds.requestArtifactCoverageDeltaValueThreshold
    ) {
      pushMetricAnomaly({
        anomalies,
        code: "request_artifact_coverage_drop",
        message: "request artifact 覆盖率低于安全阈值或相对基线明显下降。",
        severity:
          (summary.requestArtifactCoverage.latestValue ?? 1) <= args.thresholds.requestArtifactCoverageCriticalThreshold
            ? "critical"
            : "warning",
        latestExportId,
        previousExportId,
        metric: summary.requestArtifactCoverage,
        thresholdValue: args.thresholds.requestArtifactCoverageWarningThreshold,
      });
    }

    if (
      (summary.totalTokensPerSample.deltaRatio ?? 0) >= args.thresholds.tokensPerSampleWarningDeltaRatioThreshold ||
      (summary.totalTokensPerSample.latestValue ?? 0) >= args.thresholds.tokensPerSampleCriticalAbsoluteThreshold
    ) {
      pushMetricAnomaly({
        anomalies,
        code: "tokens_per_sample_spike",
        message: "单样本 token 成本相对基线明显上升。",
        severity:
          (summary.totalTokensPerSample.deltaRatio ?? 0) >= args.thresholds.tokensPerSampleCriticalDeltaRatioThreshold ||
          (summary.totalTokensPerSample.latestValue ?? 0) >= args.thresholds.tokensPerSampleCriticalAbsoluteThreshold
            ? "critical"
            : "warning",
        latestExportId,
        previousExportId,
        metric: summary.totalTokensPerSample,
        thresholdValue: args.thresholds.tokensPerSampleWarningDeltaRatioThreshold,
      });
    }
  }

  const bySeverity = new Map<string, number>();
  const byCode = new Map<string, number>();
  for (const anomaly of anomalies) {
    pushBucket(bySeverity, anomaly.severity);
    pushBucket(byCode, anomaly.code);
  }

  return {
    generatedAt: args.trendReport.generatedAt,
    filters: args.trendReport.filters,
    profileKey: args.profileKey,
    thresholds: args.thresholds,
    latestExport: latest?.export ?? null,
    previousExport: args.trendReport.points[1]?.export ?? null,
    trendSummary: summary,
    anomalies,
    bySeverity: toBuckets(bySeverity),
    byCode: toBuckets(byCode),
  };
}
