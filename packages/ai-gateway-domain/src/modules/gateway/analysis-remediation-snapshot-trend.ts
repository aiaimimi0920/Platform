import type {
  GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView,
  GatewayAnalysisAnomalyRemediationEffectivenessSnapshotReportFilterView,
  GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView,
  GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView,
  GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView,
  GatewayAnalysisAnomalyRemediationEffectivenessTrendPointView,
  GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView,
  GatewayAnalysisAnomalyRemediationEffectivenessTrendSummaryView,
  GatewayAnalysisAnomalyRemediationEffectivenessMetricView,
} from "@neuro/contracts";

function safeRatio(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (typeof numerator !== "number" || typeof denominator !== "number" || denominator <= 0) {
    return null;
  }
  return numerator / denominator;
}

function buildMetricPoint(
  metric: GatewayAnalysisAnomalyRemediationEffectivenessMetricView,
): GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView {
  const total =
    metric.improvedRuns + metric.regressedRuns + metric.neutralRuns + metric.unavailableRuns;
  return {
    improvedRate: safeRatio(metric.improvedRuns, total),
    regressedRate: safeRatio(metric.regressedRuns, total),
    neutralRate: safeRatio(metric.neutralRuns, total),
    unavailableRate: safeRatio(metric.unavailableRuns, total),
  };
}

function buildMetricSummary(
  latestValue: number | null,
  previousValue: number | null,
): GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView {
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

function buildTrendSummary(
  points: GatewayAnalysisAnomalyRemediationEffectivenessTrendPointView[],
): GatewayAnalysisAnomalyRemediationEffectivenessTrendSummaryView | null {
  const latest = points[0] ?? null;
  if (!latest) {
    return null;
  }
  const previous = points[1] ?? null;

  return {
    latestSnapshotId: latest.snapshot.snapshotId,
    previousSnapshotId: previous?.snapshot.snapshotId ?? null,
    totalRuns: buildMetricSummary(latest.totalRuns, previous?.totalRuns ?? null),
    impactedRunRate: buildMetricSummary(latest.impactedRunRate, previous?.impactedRunRate ?? null),
    unavailableRunRate: buildMetricSummary(latest.unavailableRunRate, previous?.unavailableRunRate ?? null),
    completionRateRegressed: buildMetricSummary(
      latest.completionRate.regressedRate,
      previous?.completionRate.regressedRate ?? null,
    ),
    failureRateRegressed: buildMetricSummary(
      latest.failureRate.regressedRate,
      previous?.failureRate.regressedRate ?? null,
    ),
    requestArtifactCoverageRegressed: buildMetricSummary(
      latest.requestArtifactCoverage.regressedRate,
      previous?.requestArtifactCoverage.regressedRate ?? null,
    ),
    responseArtifactCoverageRegressed: buildMetricSummary(
      latest.responseArtifactCoverage.regressedRate,
      previous?.responseArtifactCoverage.regressedRate ?? null,
    ),
    firstTokenLatencyMsAvgRegressed: buildMetricSummary(
      latest.firstTokenLatencyMsAvg.regressedRate,
      previous?.firstTokenLatencyMsAvg.regressedRate ?? null,
    ),
    totalTokensPerSampleRegressed: buildMetricSummary(
      latest.totalTokensPerSample.regressedRate,
      previous?.totalTokensPerSample.regressedRate ?? null,
    ),
  };
}

export function buildGatewayAnalysisAnomalyRemediationEffectivenessTrendPoint(
  snapshot: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView,
): GatewayAnalysisAnomalyRemediationEffectivenessTrendPointView {
  const totalRuns = snapshot.summary.totalRuns;
  return {
    snapshot,
    totalRuns,
    impactedRunRate: safeRatio(snapshot.summary.impactedRuns, totalRuns),
    unavailableRunRate: safeRatio(snapshot.summary.unavailableRuns, totalRuns),
    completionRate: buildMetricPoint(snapshot.summary.completionRate),
    failureRate: buildMetricPoint(snapshot.summary.failureRate),
    requestArtifactCoverage: buildMetricPoint(snapshot.summary.requestArtifactCoverage),
    responseArtifactCoverage: buildMetricPoint(snapshot.summary.responseArtifactCoverage),
    firstTokenLatencyMsAvg: buildMetricPoint(snapshot.summary.firstTokenLatencyMsAvg),
    totalTokensPerSample: buildMetricPoint(snapshot.summary.totalTokensPerSample),
  };
}

export function buildGatewayAnalysisAnomalyRemediationEffectivenessTrendReport(args: {
  generatedAt: string;
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotReportFilterView;
  windowSize: number;
  inventorySummary: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView;
  points: GatewayAnalysisAnomalyRemediationEffectivenessTrendPointView[];
}): GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView {
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
