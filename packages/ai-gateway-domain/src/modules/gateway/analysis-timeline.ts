import type {
  GatewayAnalysisExportBaselineReportFilterView,
  GatewayAnalysisExportInventorySummaryView,
  GatewayAnalysisExportTimelinePairView,
  GatewayAnalysisExportTimelineReportView,
  GatewayPersistedAnalysisExportView,
} from "@neuro/contracts";

export function buildGatewayAnalysisExportTimelineReport(args: {
  generatedAt: string;
  filters: GatewayAnalysisExportBaselineReportFilterView;
  windowSize: number;
  exports: GatewayPersistedAnalysisExportView[];
  inventorySummary: GatewayAnalysisExportInventorySummaryView;
  pairComparisons: GatewayAnalysisExportTimelinePairView[];
}): GatewayAnalysisExportTimelineReportView {
  return {
    generatedAt: args.generatedAt,
    filters: args.filters,
    matchedExportsCount: args.exports.length,
    windowSize: args.windowSize,
    exports: args.exports,
    inventorySummary: args.inventorySummary,
    pairComparisons: args.pairComparisons,
  };
}
