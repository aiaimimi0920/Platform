import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  GatewayAnalysisExportBaselineReportFilterView,
  GatewayAnalysisExportDiffView,
  GatewayAnalysisExportInventorySummaryView,
  GatewayPersistedAnalysisExportView,
} from "@neuro/contracts";

import { buildGatewayAnalysisExportBaselineReport } from "./analysis-baseline";

function buildExport(exportId: string): GatewayPersistedAnalysisExportView {
  return {
    exportId,
    label: exportId,
    tags: [],
    status: "active",
    createdAt: `2026-04-06T0${exportId.endsWith("1") ? "1" : "2"}:00:00.000Z`,
    updatedAt: `2026-04-06T0${exportId.endsWith("1") ? "1" : "2"}:00:00.000Z`,
    objectPrefix: `ai-gateway/analysis-exports/${exportId}`,
    filters: {
      projectId: "project_1",
      providerAccountId: null,
      sessionId: null,
      apiKeyId: null,
      responseId: null,
      protocolFamily: null,
      status: null,
      endpointKind: null,
      stream: null,
      errorCode: null,
      fallbackEligible: null,
      createdFrom: null,
      createdTo: null,
      artifactAvailable: null,
      limit: 100,
      textMode: "preview_redacted",
      maxTextChars: 4000,
    },
    sampleCount: 1,
    requestArtifactCount: 1,
    responseArtifactCount: 1,
    retentionExpiresAt: null,
    cleanedUpAt: null,
    lastCleanupError: null,
    files: [],
    manifest: {
      schemaVersion: 1,
      exportId,
      label: exportId,
      tags: [],
      createdAt: `2026-04-06T0${exportId.endsWith("1") ? "1" : "2"}:00:00.000Z`,
      retentionExpiresAt: null,
      filters: {
        projectId: "project_1",
        providerAccountId: null,
        sessionId: null,
        apiKeyId: null,
        responseId: null,
        protocolFamily: null,
        status: null,
        endpointKind: null,
        stream: null,
        errorCode: null,
        fallbackEligible: null,
        createdFrom: null,
        createdTo: null,
        artifactAvailable: null,
        limit: 100,
        textMode: "preview_redacted",
        maxTextChars: 4000,
      },
      sampleCount: 1,
      requestArtifactCount: 1,
      responseArtifactCount: 1,
      files: [],
    },
  };
}

describe("ai-gateway analysis baseline report", () => {
  it("selects the latest two exports and preserves summary + diff", () => {
    const filters: GatewayAnalysisExportBaselineReportFilterView = {
      label: null,
      tag: "baseline",
      projectId: "project_1",
      status: "active",
      textMode: "preview_redacted",
      createdFrom: null,
      createdTo: null,
    };
    const inventorySummary: GatewayAnalysisExportInventorySummaryView = {
      totalExports: 2,
      activeExports: 2,
      deletedExports: 0,
      pinnedExports: 0,
      expiringWithin24Hours: 0,
      expiredActiveExports: 0,
      totalSampleCount: 2,
      totalRequestArtifactCount: 2,
      totalResponseArtifactCount: 2,
      byStatus: [{ key: "active", count: 2 }],
      byTextMode: [{ key: "preview_redacted", count: 2 }],
      byTag: [{ key: "baseline", count: 2 }],
      byProject: [{ key: "project_1", count: 2 }],
    };
    const diff: GatewayAnalysisExportDiffView = {
      leftExport: buildExport("export_1"),
      rightExport: buildExport("export_2"),
      overlapRequestCount: 1,
      leftOnlyRequestCount: 0,
      rightOnlyRequestCount: 0,
      sampleCount: { leftValue: 1, rightValue: 1, deltaValue: 0 },
      requestArtifactCount: { leftValue: 1, rightValue: 1, deltaValue: 0 },
      responseArtifactCount: { leftValue: 1, rightValue: 1, deltaValue: 0 },
      promptTokens: { leftValue: 1, rightValue: 1, deltaValue: 0 },
      completionTokens: { leftValue: 1, rightValue: 1, deltaValue: 0 },
      totalTokens: { leftValue: 2, rightValue: 2, deltaValue: 0 },
      byStatus: [],
      byProtocolFamily: [],
      byEndpointKind: [],
      byResolvedModel: [],
      byProviderAccount: [],
    };

    const report = buildGatewayAnalysisExportBaselineReport({
      generatedAt: "2026-04-06T12:00:00.000Z",
      filters,
      exports: [buildExport("export_2"), buildExport("export_1")],
      inventorySummary,
      diff,
    });

    assert.equal(report.matchedExportsCount, 2);
    assert.equal(report.latestExport?.exportId, "export_2");
    assert.equal(report.previousExport?.exportId, "export_1");
    assert.equal(report.inventorySummary.totalExports, 2);
    assert.equal(report.diff?.overlapRequestCount, 1);
  });
});
