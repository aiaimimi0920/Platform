import type {
  GatewayAnalysisExportBaselineReportFilterView,
  GatewayAnalysisExportInventorySummaryView,
  GatewayAnalysisExportTrendMetricSummaryView,
  GatewayAnalysisExportTrendPointView,
  GatewayAnalysisExportTrendReportView,
  GatewayAnalysisExportTrendSummaryView,
} from "@neuro/contracts";

function buildMetricSummary(latestValue: number | null, previousValue: number | null): GatewayAnalysisExportTrendMetricSummaryView {
  const deltaValue =
    typeof latestValue === "number" && typeof previousValue === "number" ? latestValue - previousValue : null;
  const deltaRatio =
    typeof latestValue === "number" &&
    typeof previousValue === "number" &&
    previousValue !== 0
      ? deltaValue! / previousValue
      : null;
  return {
    latestValue,
    previousValue,
    deltaValue,
    deltaRatio,
  };
}

function safeRatio(numerator: number | null, denominator: number | null) {
  if (typeof numerator !== "number" || typeof denominator !== "number" || denominator <= 0) {
    return null;
  }
  return numerator / denominator;
}

function buildTrendSummary(points: GatewayAnalysisExportTrendPointView[]): GatewayAnalysisExportTrendSummaryView | null {
  const latest = points[0] ?? null;
  if (!latest) {
    return null;
  }
  const previous = points[1] ?? null;

  return {
    latestExportId: latest.export.exportId,
    previousExportId: previous?.export.exportId ?? null,
    promptTokensPerSample: buildMetricSummary(
      safeRatio(latest.promptTokens, latest.export.sampleCount),
      safeRatio(previous?.promptTokens ?? null, previous?.export.sampleCount ?? null),
    ),
    completionTokensPerSample: buildMetricSummary(
      safeRatio(latest.completionTokens, latest.export.sampleCount),
      safeRatio(previous?.completionTokens ?? null, previous?.export.sampleCount ?? null),
    ),
    totalTokensPerSample: buildMetricSummary(
      safeRatio(latest.totalTokens, latest.export.sampleCount),
      safeRatio(previous?.totalTokens ?? null, previous?.export.sampleCount ?? null),
    ),
    requestArtifactCoverage: buildMetricSummary(
      safeRatio(latest.export.requestArtifactCount, latest.export.sampleCount),
      safeRatio(previous?.export.requestArtifactCount ?? null, previous?.export.sampleCount ?? null),
    ),
    responseArtifactCoverage: buildMetricSummary(
      safeRatio(latest.export.responseArtifactCount, latest.export.sampleCount),
      safeRatio(previous?.export.responseArtifactCount ?? null, previous?.export.sampleCount ?? null),
    ),
    streamRate: buildMetricSummary(
      safeRatio(latest.streamSamples, latest.export.sampleCount),
      safeRatio(previous?.streamSamples ?? null, previous?.export.sampleCount ?? null),
    ),
    completionRate: buildMetricSummary(
      safeRatio(latest.completedSamples, latest.export.sampleCount),
      safeRatio(previous?.completedSamples ?? null, previous?.export.sampleCount ?? null),
    ),
    failureRate: buildMetricSummary(
      safeRatio(latest.failedSamples, latest.export.sampleCount),
      safeRatio(previous?.failedSamples ?? null, previous?.export.sampleCount ?? null),
    ),
    cancellationRate: buildMetricSummary(
      safeRatio(latest.cancelledSamples, latest.export.sampleCount),
      safeRatio(previous?.cancelledSamples ?? null, previous?.export.sampleCount ?? null),
    ),
    toolRequestRate: buildMetricSummary(
      safeRatio(latest.toolRequestSamples, latest.export.sampleCount),
      safeRatio(previous?.toolRequestSamples ?? null, previous?.export.sampleCount ?? null),
    ),
    toolResponseRate: buildMetricSummary(
      safeRatio(latest.toolResponseSamples, latest.export.sampleCount),
      safeRatio(previous?.toolResponseSamples ?? null, previous?.export.sampleCount ?? null),
    ),
    reasoningRate: buildMetricSummary(
      safeRatio(latest.reasoningSamples, latest.export.sampleCount),
      safeRatio(previous?.reasoningSamples ?? null, previous?.export.sampleCount ?? null),
    ),
    metadataRate: buildMetricSummary(
      safeRatio(latest.metadataSamples, latest.export.sampleCount),
      safeRatio(previous?.metadataSamples ?? null, previous?.export.sampleCount ?? null),
    ),
    explicitSessionRate: buildMetricSummary(
      safeRatio(latest.explicitSessionSamples, latest.export.sampleCount),
      safeRatio(previous?.explicitSessionSamples ?? null, previous?.export.sampleCount ?? null),
    ),
    previousResponseRate: buildMetricSummary(
      safeRatio(latest.previousResponseSamples, latest.export.sampleCount),
      safeRatio(previous?.previousResponseSamples ?? null, previous?.export.sampleCount ?? null),
    ),
  };
}

export function buildGatewayAnalysisExportTrendReport(args: {
  generatedAt: string;
  filters: GatewayAnalysisExportBaselineReportFilterView;
  windowSize: number;
  inventorySummary: GatewayAnalysisExportInventorySummaryView;
  points: GatewayAnalysisExportTrendPointView[];
}): GatewayAnalysisExportTrendReportView {
  return {
    generatedAt: args.generatedAt,
    filters: args.filters,
    matchedExportsCount: args.points.length,
    windowSize: args.windowSize,
    inventorySummary: args.inventorySummary,
    points: args.points,
    summary: buildTrendSummary(args.points),
  };
}
