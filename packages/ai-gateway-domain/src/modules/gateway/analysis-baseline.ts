import type {
  GatewayAnalysisExportBaselineReportFilterView,
  GatewayAnalysisExportBaselineReportView,
  GatewayAnalysisExportDiffView,
  GatewayAnalysisExportInventorySummaryView,
  GatewayPersistedAnalysisExportView,
} from "@neuro/contracts";

export function buildGatewayAnalysisExportBaselineReport(args: {
  generatedAt: string;
  filters: GatewayAnalysisExportBaselineReportFilterView;
  exports: GatewayPersistedAnalysisExportView[];
  inventorySummary: GatewayAnalysisExportInventorySummaryView;
  diff: GatewayAnalysisExportDiffView | null;
}): GatewayAnalysisExportBaselineReportView {
  return {
    generatedAt: args.generatedAt,
    filters: args.filters,
    matchedExportsCount: args.exports.length,
    latestExport: args.exports[0] ?? null,
    previousExport: args.exports[1] ?? null,
    inventorySummary: args.inventorySummary,
    diff: args.diff,
  };
}
