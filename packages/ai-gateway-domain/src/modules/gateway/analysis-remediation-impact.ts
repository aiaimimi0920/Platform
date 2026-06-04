import type {
  GatewayAnalysisAnomalyRemediationImpactMetricView,
  GatewayAnalysisAnomalyRemediationRunImpactView,
  GatewayAnalysisAnomalyRemediationRunSummaryView,
  GatewayAnalysisAnomalyIncidentRemediationRunView,
  GatewayAnalysisAnomalyIncidentView,
  GatewayAnalysisSummaryView,
  GatewaySummaryBucket,
} from "@neuro/contracts";

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

function hasIncidentMeaningfulChanges(
  beforeIncident: GatewayAnalysisAnomalyIncidentView | null,
  afterIncident: GatewayAnalysisAnomalyIncidentView | null,
) {
  if (!beforeIncident && !afterIncident) {
    return false;
  }
  if (!beforeIncident || !afterIncident) {
    return true;
  }
  return JSON.stringify({
    ownerUserId: beforeIncident.ownerUserId,
    followUpStatus: beforeIncident.followUpStatus,
    status: beforeIncident.status,
    escalationStatus: beforeIncident.escalationStatus,
    latestNote: beforeIncident.latestNote,
    resolutionNote: beforeIncident.resolutionNote,
  }) !==
    JSON.stringify({
      ownerUserId: afterIncident.ownerUserId,
      followUpStatus: afterIncident.followUpStatus,
      status: afterIncident.status,
      escalationStatus: afterIncident.escalationStatus,
      latestNote: afterIncident.latestNote,
      resolutionNote: afterIncident.resolutionNote,
    });
}

function hasRoutePolicyMeaningfulChanges(
  run: GatewayAnalysisAnomalyIncidentRemediationRunView,
) {
  if (!run.beforeRoutePolicy && !run.afterRoutePolicy) {
    return false;
  }
  if (!run.beforeRoutePolicy || !run.afterRoutePolicy) {
    return true;
  }
  return JSON.stringify({
    enabled: run.beforeRoutePolicy.enabled,
    isDefault: run.beforeRoutePolicy.isDefault,
    config: run.beforeRoutePolicy.config,
  }) !==
    JSON.stringify({
      enabled: run.afterRoutePolicy.enabled,
      isDefault: run.afterRoutePolicy.isDefault,
      config: run.afterRoutePolicy.config,
    });
}

function ratio(count: number, total: number) {
  if (total <= 0) {
    return null;
  }
  return Number((count / total).toFixed(4));
}

function perSample(total: number, sampleCount: number) {
  if (sampleCount <= 0) {
    return null;
  }
  return Number((total / sampleCount).toFixed(4));
}

function delta(beforeValue: number | null, afterValue: number | null): GatewayAnalysisAnomalyRemediationImpactMetricView {
  const deltaValue =
    beforeValue == null || afterValue == null ? null : Number((afterValue - beforeValue).toFixed(4));
  const deltaRatio =
    beforeValue == null || afterValue == null || beforeValue === 0
      ? null
      : Number(((afterValue - beforeValue) / beforeValue).toFixed(4));
  return {
    beforeValue,
    afterValue,
    deltaValue,
    deltaRatio,
  };
}

function valueFromSummary(summary: GatewayAnalysisSummaryView, key: keyof GatewayAnalysisAnomalyRemediationRunImpactView["metrics"]) {
  switch (key) {
    case "completionRate":
      return ratio(summary.completedSamples, summary.totalSamples);
    case "failureRate":
      return ratio(summary.failedSamples, summary.totalSamples);
    case "cancellationRate":
      return ratio(summary.cancelledSamples, summary.totalSamples);
    case "streamRate":
      return ratio(summary.streamSamples, summary.totalSamples);
    case "toolRequestRate":
      return ratio(summary.toolRequestSamples, summary.totalSamples);
    case "toolResponseRate":
      return ratio(summary.toolResponseSamples, summary.totalSamples);
    case "requestArtifactCoverage":
      return ratio(summary.requestArtifactSamples, summary.totalSamples);
    case "responseArtifactCoverage":
      return ratio(summary.responseArtifactSamples, summary.totalSamples);
    case "promptTokensPerSample":
      return perSample(summary.totalPromptTokens, summary.totalSamples);
    case "completionTokensPerSample":
      return perSample(summary.totalCompletionTokens, summary.totalSamples);
    case "totalTokensPerSample":
      return perSample(summary.totalTokens, summary.totalSamples);
    case "requestTextCharsAvg":
      return summary.requestTextChars.avg;
    case "responseTextCharsAvg":
      return summary.responseTextChars.avg;
    case "firstTokenLatencyMsAvg":
      return summary.firstTokenLatencyMs.avg;
    case "streamChunkCountAvg":
      return summary.streamChunkCount.avg;
    default:
      return null;
  }
}

export function buildGatewayAnalysisAnomalyRemediationRunSummary(args: {
  runs: GatewayAnalysisAnomalyIncidentRemediationRunView[];
}): GatewayAnalysisAnomalyRemediationRunSummaryView {
  const byStatus = new Map<string, number>();
  const byExecutionMode = new Map<string, number>();
  const byActionKey = new Map<string, number>();
  const byPolicyId = new Map<string, number>();
  const byRoutePolicyId = new Map<string, number>();
  const incidentIds = new Set<string>();

  let dryRunRuns = 0;
  let appliedRuns = 0;
  let failedRuns = 0;
  let routePolicyChangedRuns = 0;
  let incidentChangedRuns = 0;

  for (const run of args.runs) {
    incrementBucket(byStatus, run.status);
    incrementBucket(byExecutionMode, run.executionMode);
    incrementBucket(byActionKey, run.actionKey);
    incrementBucket(byPolicyId, run.policyId);
    incrementBucket(byRoutePolicyId, run.routePolicyId);
    incidentIds.add(run.incidentId);

    if (run.status === "dry_run") {
      dryRunRuns += 1;
    } else if (run.status === "applied") {
      appliedRuns += 1;
    } else if (run.status === "failed") {
      failedRuns += 1;
    }

    if (hasRoutePolicyMeaningfulChanges(run)) {
      routePolicyChangedRuns += 1;
    }
    if (hasIncidentMeaningfulChanges(run.beforeIncident, run.afterIncident)) {
      incidentChangedRuns += 1;
    }
  }

  return {
    totalRuns: args.runs.length,
    dryRunRuns,
    appliedRuns,
    failedRuns,
    distinctIncidentCount: incidentIds.size,
    routePolicyChangedRuns,
    incidentChangedRuns,
    byStatus: toBuckets(byStatus),
    byExecutionMode: toBuckets(byExecutionMode),
    byActionKey: toBuckets(byActionKey),
    byPolicyId: toBuckets(byPolicyId),
    byRoutePolicyId: toBuckets(byRoutePolicyId),
  };
}

export function buildGatewayAnalysisAnomalyRemediationRunImpact(args: {
  generatedAt: string;
  run: GatewayAnalysisAnomalyIncidentRemediationRunView;
  incident: GatewayAnalysisAnomalyIncidentView | null;
  projectId: string | null;
  routePolicyId: string | null;
  anchorAt: string;
  windowMinutes: number;
  beforeWindow: {
    startedAt: string;
    endedAt: string;
    summary: GatewayAnalysisSummaryView;
  };
  afterWindow: {
    startedAt: string;
    endedAt: string;
    summary: GatewayAnalysisSummaryView;
  };
}): GatewayAnalysisAnomalyRemediationRunImpactView {
  const metricKeys = [
    "completionRate",
    "failureRate",
    "cancellationRate",
    "streamRate",
    "toolRequestRate",
    "toolResponseRate",
    "requestArtifactCoverage",
    "responseArtifactCoverage",
    "promptTokensPerSample",
    "completionTokensPerSample",
    "totalTokensPerSample",
    "requestTextCharsAvg",
    "responseTextCharsAvg",
    "firstTokenLatencyMsAvg",
    "streamChunkCountAvg",
  ] as const;

  const metrics = Object.fromEntries(
    metricKeys.map((key) => [
      key,
      delta(valueFromSummary(args.beforeWindow.summary, key), valueFromSummary(args.afterWindow.summary, key)),
    ]),
  ) as GatewayAnalysisAnomalyRemediationRunImpactView["metrics"];

  return {
    generatedAt: args.generatedAt,
    run: args.run,
    incident: args.incident,
    projectId: args.projectId,
    routePolicyId: args.routePolicyId,
    anchorAt: args.anchorAt,
    windowMinutes: args.windowMinutes,
    beforeWindow: args.beforeWindow,
    afterWindow: args.afterWindow,
    metrics,
  };
}
