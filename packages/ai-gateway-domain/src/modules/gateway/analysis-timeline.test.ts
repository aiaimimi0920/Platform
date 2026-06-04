import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  GatewayAnalysisExportInventorySummaryView,
  GatewayAnalysisExportTimelinePairView,
  GatewayPersistedAnalysisExportView,
} from "@neuro/contracts";

import { buildGatewayAnalysisExportTimelineReport } from "./analysis-timeline";

function buildExport(exportId: string): GatewayPersistedAnalysisExportView {
  return {
    exportId,
    label: exportId,
    tags: [],
    status: "active",
    createdAt: "2026-04-06T12:00:00.000Z",
    updatedAt: "2026-04-06T12:00:00.000Z",
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
      createdAt: "2026-04-06T12:00:00.000Z",
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

describe("ai-gateway analysis timeline report", () => {
  it("keeps ordered exports and adjacent comparisons", () => {
    const exports = [buildExport("export_3"), buildExport("export_2"), buildExport("export_1")];
    const inventorySummary: GatewayAnalysisExportInventorySummaryView = {
      totalExports: 3,
      activeExports: 3,
      deletedExports: 0,
      pinnedExports: 0,
      expiringWithin24Hours: 0,
      expiredActiveExports: 0,
      totalSampleCount: 3,
      totalRequestArtifactCount: 3,
      totalResponseArtifactCount: 3,
      byStatus: [{ key: "active", count: 3 }],
      byTextMode: [{ key: "preview_redacted", count: 3 }],
      byTag: [],
      byProject: [{ key: "project_1", count: 3 }],
    };
    const pairComparisons: GatewayAnalysisExportTimelinePairView[] = [
      {
        newerExport: exports[0]!,
        olderExport: exports[1]!,
        diff: null,
        diffUnavailableReason: "dataset_missing",
      },
      {
        newerExport: exports[1]!,
        olderExport: exports[2]!,
        diff: null,
        diffUnavailableReason: "dataset_missing",
      },
    ];

    const report = buildGatewayAnalysisExportTimelineReport({
      generatedAt: "2026-04-06T12:30:00.000Z",
      filters: {
        label: null,
        tag: "rolling",
        projectId: "project_1",
        status: "active",
        textMode: "preview_redacted",
        createdFrom: null,
        createdTo: null,
      },
      windowSize: 3,
      exports,
      inventorySummary,
      pairComparisons,
    });

    assert.equal(report.windowSize, 3);
    assert.equal(report.matchedExportsCount, 3);
    assert.equal(report.exports[0]?.exportId, "export_3");
    assert.equal(report.pairComparisons.length, 2);
    assert.equal(report.pairComparisons[0]?.newerExport.exportId, "export_3");
    assert.equal(report.pairComparisons[0]?.olderExport.exportId, "export_2");
    assert.equal(report.pairComparisons[0]?.diffUnavailableReason, "dataset_missing");
  });
});
