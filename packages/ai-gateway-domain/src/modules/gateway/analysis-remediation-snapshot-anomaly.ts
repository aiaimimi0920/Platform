import type {
  GatewayAnalysisAnomalyRemediationEffectivenessAnomalyCode,
  GatewayAnalysisAnomalyRemediationEffectivenessAnomalyReportView,
  GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig,
  GatewayAnalysisAnomalyRemediationEffectivenessAnomalyView,
  GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView,
  GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView,
  GatewayAnalysisExportAnomalySeverity,
  GatewayAnalysisExportAnomalyProfileKey,
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

export function buildGatewayAnalysisAnomalyRemediationEffectivenessThresholdConfig(
  profileKey: GatewayAnalysisExportAnomalyProfileKey,
  overrides: Partial<GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig> = {},
): GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig {
  const base: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig =
    profileKey === "conservative"
      ? {
          impactedRunRateWarningThreshold: 0.5,
          impactedRunRateCriticalThreshold: 0.35,
          unavailableRunRateWarningThreshold: 0.4,
          unavailableRunRateCriticalThreshold: 0.6,
          completionRateRegressedWarningThreshold: 0.35,
          completionRateRegressedCriticalThreshold: 0.55,
          failureRateRegressedWarningThreshold: 0.35,
          failureRateRegressedCriticalThreshold: 0.55,
          requestArtifactRegressedWarningThreshold: 0.35,
          requestArtifactRegressedCriticalThreshold: 0.55,
          responseArtifactRegressedWarningThreshold: 0.35,
          responseArtifactRegressedCriticalThreshold: 0.55,
          firstTokenLatencyRegressedWarningThreshold: 0.35,
          firstTokenLatencyRegressedCriticalThreshold: 0.55,
          totalTokensRegressedWarningThreshold: 0.35,
          totalTokensRegressedCriticalThreshold: 0.55,
        }
      : profileKey === "aggressive"
        ? {
            impactedRunRateWarningThreshold: 0.75,
            impactedRunRateCriticalThreshold: 0.6,
            unavailableRunRateWarningThreshold: 0.18,
            unavailableRunRateCriticalThreshold: 0.3,
            completionRateRegressedWarningThreshold: 0.18,
            completionRateRegressedCriticalThreshold: 0.3,
            failureRateRegressedWarningThreshold: 0.18,
            failureRateRegressedCriticalThreshold: 0.3,
            requestArtifactRegressedWarningThreshold: 0.18,
            requestArtifactRegressedCriticalThreshold: 0.3,
            responseArtifactRegressedWarningThreshold: 0.18,
            responseArtifactRegressedCriticalThreshold: 0.3,
            firstTokenLatencyRegressedWarningThreshold: 0.18,
            firstTokenLatencyRegressedCriticalThreshold: 0.3,
            totalTokensRegressedWarningThreshold: 0.18,
            totalTokensRegressedCriticalThreshold: 0.3,
          }
        : {
            impactedRunRateWarningThreshold: 0.65,
            impactedRunRateCriticalThreshold: 0.45,
            unavailableRunRateWarningThreshold: 0.25,
            unavailableRunRateCriticalThreshold: 0.4,
            completionRateRegressedWarningThreshold: 0.25,
            completionRateRegressedCriticalThreshold: 0.4,
            failureRateRegressedWarningThreshold: 0.25,
            failureRateRegressedCriticalThreshold: 0.4,
            requestArtifactRegressedWarningThreshold: 0.25,
            requestArtifactRegressedCriticalThreshold: 0.4,
            responseArtifactRegressedWarningThreshold: 0.25,
            responseArtifactRegressedCriticalThreshold: 0.4,
            firstTokenLatencyRegressedWarningThreshold: 0.25,
            firstTokenLatencyRegressedCriticalThreshold: 0.4,
            totalTokensRegressedWarningThreshold: 0.25,
            totalTokensRegressedCriticalThreshold: 0.4,
          };

  return {
    ...base,
    ...overrides,
  };
}

function pushMetricAnomaly(args: {
  anomalies: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyView[];
  code: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyCode;
  message: string;
  severity: GatewayAnalysisExportAnomalySeverity;
  latestSnapshotId: string | null;
  previousSnapshotId: string | null;
  metric: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  thresholdValue: number;
}) {
  args.anomalies.push({
    code: args.code,
    severity: args.severity,
    message: args.message,
    latestSnapshotId: args.latestSnapshotId,
    previousSnapshotId: args.previousSnapshotId,
    latestValue: args.metric.latestValue,
    previousValue: args.metric.previousValue,
    deltaValue: args.metric.deltaValue,
    deltaRatio: args.metric.deltaRatio,
    thresholdValue: args.thresholdValue,
  });
}

export function buildGatewayAnalysisAnomalyRemediationEffectivenessAnomalyReport(args: {
  trendReport: GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig;
}): GatewayAnalysisAnomalyRemediationEffectivenessAnomalyReportView {
  const anomalies: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyView[] = [];
  const summary = args.trendReport.summary;
  const latestSnapshot = args.trendReport.points[0]?.snapshot ?? null;
  const previousSnapshot = args.trendReport.points[1]?.snapshot ?? null;

  if (summary) {
    if ((summary.impactedRunRate.latestValue ?? 1) <= args.thresholds.impactedRunRateWarningThreshold) {
      pushMetricAnomaly({
        anomalies,
        code: "impacted_run_rate_drop",
        message: "治理效果样本命中率偏低，当前窗口里可评估 run 太少，效果结论不稳定。",
        severity:
          (summary.impactedRunRate.latestValue ?? 1) <= args.thresholds.impactedRunRateCriticalThreshold
            ? "critical"
            : "warning",
        latestSnapshotId: summary.latestSnapshotId,
        previousSnapshotId: summary.previousSnapshotId,
        metric: summary.impactedRunRate,
        thresholdValue: args.thresholds.impactedRunRateWarningThreshold,
      });
    }

    if ((summary.unavailableRunRate.latestValue ?? 0) >= args.thresholds.unavailableRunRateWarningThreshold) {
      pushMetricAnomaly({
        anomalies,
        code: "unavailable_run_rate_spike",
        message: "治理效果快照里的 unavailable run 比例过高，impact capture 链路需要排查。",
        severity:
          (summary.unavailableRunRate.latestValue ?? 0) >= args.thresholds.unavailableRunRateCriticalThreshold
            ? "critical"
            : "warning",
        latestSnapshotId: summary.latestSnapshotId,
        previousSnapshotId: summary.previousSnapshotId,
        metric: summary.unavailableRunRate,
        thresholdValue: args.thresholds.unavailableRunRateWarningThreshold,
      });
    }

    const checks: Array<{
      code: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyCode;
      message: string;
      metric: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
      warning: number;
      critical: number;
    }> = [
      {
        code: "completion_effectiveness_regressed",
        message: "completion 效果回归比例偏高，最近一批 remediation 可能没有改善完成率。",
        metric: summary.completionRateRegressed,
        warning: args.thresholds.completionRateRegressedWarningThreshold,
        critical: args.thresholds.completionRateRegressedCriticalThreshold,
      },
      {
        code: "failure_effectiveness_regressed",
        message: "failure 效果回归比例偏高，最近一批 remediation 可能放大了失败率。",
        metric: summary.failureRateRegressed,
        warning: args.thresholds.failureRateRegressedWarningThreshold,
        critical: args.thresholds.failureRateRegressedCriticalThreshold,
      },
      {
        code: "request_artifact_effectiveness_regressed",
        message: "request artifact 效果回归比例偏高，治理动作可能伤到了留存链路。",
        metric: summary.requestArtifactCoverageRegressed,
        warning: args.thresholds.requestArtifactRegressedWarningThreshold,
        critical: args.thresholds.requestArtifactRegressedCriticalThreshold,
      },
      {
        code: "response_artifact_effectiveness_regressed",
        message: "response artifact 效果回归比例偏高，治理动作可能伤到了 response 留存覆盖率。",
        metric: summary.responseArtifactCoverageRegressed,
        warning: args.thresholds.responseArtifactRegressedWarningThreshold,
        critical: args.thresholds.responseArtifactRegressedCriticalThreshold,
      },
      {
        code: "latency_effectiveness_regressed",
        message: "首 token latency 的回归比例偏高，最近一批 remediation 可能拖慢了热路径。",
        metric: summary.firstTokenLatencyMsAvgRegressed,
        warning: args.thresholds.firstTokenLatencyRegressedWarningThreshold,
        critical: args.thresholds.firstTokenLatencyRegressedCriticalThreshold,
      },
      {
        code: "token_effectiveness_regressed",
        message: "单样本 token 成本的回归比例偏高，最近一批 remediation 可能提高了成本。",
        metric: summary.totalTokensPerSampleRegressed,
        warning: args.thresholds.totalTokensRegressedWarningThreshold,
        critical: args.thresholds.totalTokensRegressedCriticalThreshold,
      },
    ];

    for (const item of checks) {
      if ((item.metric.latestValue ?? 0) < item.warning) {
        continue;
      }
      pushMetricAnomaly({
        anomalies,
        code: item.code,
        message: item.message,
        severity: (item.metric.latestValue ?? 0) >= item.critical ? "critical" : "warning",
        latestSnapshotId: summary.latestSnapshotId,
        previousSnapshotId: summary.previousSnapshotId,
        metric: item.metric,
        thresholdValue: item.warning,
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
    latestSnapshot,
    previousSnapshot,
    trendSummary: summary,
    anomalies,
    bySeverity: toBuckets(bySeverity),
    byCode: toBuckets(byCode),
  };
}
