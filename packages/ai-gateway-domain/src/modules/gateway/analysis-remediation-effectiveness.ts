import type {
  GatewayAnalysisAnomalyRemediationActionEffectivenessView,
  GatewayAnalysisAnomalyRemediationEffectivenessMetricView,
  GatewayAnalysisAnomalyRemediationEffectivenessSummaryView,
  GatewayAnalysisAnomalyRemediationRunImpactView,
  GatewayAnalysisAnomalyIncidentRemediationRunView,
  GatewaySummaryBucket,
} from "@neuro/contracts";

type MetricDirection = "higher_better" | "lower_better";
type MetricKey =
  | "completionRate"
  | "failureRate"
  | "requestArtifactCoverage"
  | "responseArtifactCoverage"
  | "firstTokenLatencyMsAvg"
  | "totalTokensPerSample";

const metricDirections: Record<MetricKey, MetricDirection> = {
  completionRate: "higher_better",
  failureRate: "lower_better",
  requestArtifactCoverage: "higher_better",
  responseArtifactCoverage: "higher_better",
  firstTokenLatencyMsAvg: "lower_better",
  totalTokensPerSample: "lower_better",
};

const metricThresholds: Record<MetricKey, { deltaValue?: number; deltaRatio?: number }> = {
  completionRate: { deltaValue: 0.02 },
  failureRate: { deltaValue: 0.02 },
  requestArtifactCoverage: { deltaValue: 0.05 },
  responseArtifactCoverage: { deltaValue: 0.05 },
  firstTokenLatencyMsAvg: { deltaValue: 50 },
  totalTokensPerSample: { deltaRatio: 0.1 },
};

type Classification = "improved" | "regressed" | "neutral" | "unavailable";

function emptyMetric(): GatewayAnalysisAnomalyRemediationEffectivenessMetricView {
  return {
    improvedRuns: 0,
    regressedRuns: 0,
    neutralRuns: 0,
    unavailableRuns: 0,
  };
}

function emptyAction(actionKey: string): GatewayAnalysisAnomalyRemediationActionEffectivenessView {
  return {
    actionKey,
    runCount: 0,
    impactedRunCount: 0,
    unavailableRunCount: 0,
    completionRate: emptyMetric(),
    failureRate: emptyMetric(),
    requestArtifactCoverage: emptyMetric(),
    responseArtifactCoverage: emptyMetric(),
    firstTokenLatencyMsAvg: emptyMetric(),
    totalTokensPerSample: emptyMetric(),
  };
}

function incrementBucket(map: Map<string, number>, key: string | null | undefined) {
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

function classifyMetric(
  impact: GatewayAnalysisAnomalyRemediationRunImpactView,
  key: MetricKey,
): Classification {
  const metric = impact.metrics[key];
  if (!metric) {
    return "unavailable";
  }
  if (metric.beforeValue == null || metric.afterValue == null || metric.deltaValue == null) {
    return "unavailable";
  }
  const threshold = metricThresholds[key];
  if (typeof threshold.deltaRatio === "number") {
    if (metric.deltaRatio == null) {
      return "unavailable";
    }
    if (Math.abs(metric.deltaRatio) < threshold.deltaRatio) {
      return "neutral";
    }
    if (metricDirections[key] === "higher_better") {
      return metric.deltaRatio > 0 ? "improved" : "regressed";
    }
    return metric.deltaRatio < 0 ? "improved" : "regressed";
  }

  const absoluteThreshold = threshold.deltaValue ?? 0;
  if (Math.abs(metric.deltaValue) < absoluteThreshold) {
    return "neutral";
  }
  if (metricDirections[key] === "higher_better") {
    return metric.deltaValue > 0 ? "improved" : "regressed";
  }
  return metric.deltaValue < 0 ? "improved" : "regressed";
}

function addClassification(
  target: GatewayAnalysisAnomalyRemediationEffectivenessMetricView,
  classification: Classification,
) {
  if (classification === "improved") {
    target.improvedRuns += 1;
  } else if (classification === "regressed") {
    target.regressedRuns += 1;
  } else if (classification === "neutral") {
    target.neutralRuns += 1;
  } else {
    target.unavailableRuns += 1;
  }
}

function extractCapturedImpact(
  run: GatewayAnalysisAnomalyIncidentRemediationRunView,
  expectedWindowMinutes: number,
) {
  const payload = run.result;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const capture = (payload as Record<string, unknown>).impactCapture;
  if (!capture || typeof capture !== "object") {
    return null;
  }
  const record = capture as Record<string, unknown>;
  if (record.windowMinutes !== expectedWindowMinutes) {
    return null;
  }
  const impact = record.impact;
  if (!impact || typeof impact !== "object") {
    return null;
  }
  return impact as GatewayAnalysisAnomalyRemediationRunImpactView;
}

export function buildGatewayAnalysisAnomalyRemediationEffectivenessSummary(args: {
  generatedAt: string;
  windowMinutes: number;
  runs: GatewayAnalysisAnomalyIncidentRemediationRunView[];
  impacts: Array<GatewayAnalysisAnomalyRemediationRunImpactView | null>;
}): GatewayAnalysisAnomalyRemediationEffectivenessSummaryView {
  const byStatus = new Map<string, number>();
  const byExecutionMode = new Map<string, number>();
  const byActionKey = new Map<string, number>();
  const actionMap = new Map<string, GatewayAnalysisAnomalyRemediationActionEffectivenessView>();

  const globalMetrics = {
    completionRate: emptyMetric(),
    failureRate: emptyMetric(),
    requestArtifactCoverage: emptyMetric(),
    responseArtifactCoverage: emptyMetric(),
    firstTokenLatencyMsAvg: emptyMetric(),
    totalTokensPerSample: emptyMetric(),
  } satisfies Omit<
    GatewayAnalysisAnomalyRemediationEffectivenessSummaryView,
    "generatedAt" | "windowMinutes" | "totalRuns" | "impactedRuns" | "unavailableRuns" | "byStatus" | "byExecutionMode" | "byActionKey" | "actions"
  >;

  let impactedRuns = 0;
  let unavailableRuns = 0;

  args.runs.forEach((run, index) => {
    const impact = args.impacts[index] ?? extractCapturedImpact(run, args.windowMinutes);
    incrementBucket(byStatus, run.status);
    incrementBucket(byExecutionMode, run.executionMode);
    incrementBucket(byActionKey, run.actionKey);

    const actionSummary = actionMap.get(run.actionKey) ?? emptyAction(run.actionKey);
    actionSummary.runCount += 1;

    if (!impact) {
      unavailableRuns += 1;
      actionSummary.unavailableRunCount += 1;
      (Object.keys(globalMetrics) as MetricKey[]).forEach((key) => {
        addClassification(globalMetrics[key], "unavailable");
        addClassification(actionSummary[key], "unavailable");
      });
      actionMap.set(run.actionKey, actionSummary);
      return;
    }

    impactedRuns += 1;
    actionSummary.impactedRunCount += 1;
    (Object.keys(globalMetrics) as MetricKey[]).forEach((key) => {
      const classification = classifyMetric(impact, key);
      addClassification(globalMetrics[key], classification);
      addClassification(actionSummary[key], classification);
    });
    actionMap.set(run.actionKey, actionSummary);
  });

  return {
    generatedAt: args.generatedAt,
    windowMinutes: args.windowMinutes,
    totalRuns: args.runs.length,
    impactedRuns,
    unavailableRuns,
    byStatus: toBuckets(byStatus),
    byExecutionMode: toBuckets(byExecutionMode),
    byActionKey: toBuckets(byActionKey),
    completionRate: globalMetrics.completionRate,
    failureRate: globalMetrics.failureRate,
    requestArtifactCoverage: globalMetrics.requestArtifactCoverage,
    responseArtifactCoverage: globalMetrics.responseArtifactCoverage,
    firstTokenLatencyMsAvg: globalMetrics.firstTokenLatencyMsAvg,
    totalTokensPerSample: globalMetrics.totalTokensPerSample,
    actions: Array.from(actionMap.values()).sort((left, right) => right.runCount - left.runCount || left.actionKey.localeCompare(right.actionKey)),
  };
}
