import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  GatewayAnalysisExportInventorySummaryView,
  GatewayAnalysisExportTrendPointView,
  GatewayPersistedAnalysisExportView,
} from "@neuro/contracts";

import { buildGatewayAnalysisExportTrendReport } from "./analysis-trend";

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
    sampleCount: 10,
    requestArtifactCount: 9,
    responseArtifactCount: 8,
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
      sampleCount: 10,
      requestArtifactCount: 9,
      responseArtifactCount: 8,
      files: [],
    },
  };
}

describe("ai-gateway analysis trend report", () => {
  it("keeps ordered trend points with inventory summary", () => {
    const inventorySummary: GatewayAnalysisExportInventorySummaryView = {
      totalExports: 2,
      activeExports: 2,
      deletedExports: 0,
      pinnedExports: 0,
      expiringWithin24Hours: 0,
      expiredActiveExports: 0,
      totalSampleCount: 20,
      totalRequestArtifactCount: 18,
      totalResponseArtifactCount: 16,
      byStatus: [{ key: "active", count: 2 }],
      byTextMode: [{ key: "preview_redacted", count: 2 }],
      byTag: [{ key: "rolling", count: 2 }],
      byProject: [{ key: "project_1", count: 2 }],
    };
    const points: GatewayAnalysisExportTrendPointView[] = [
      {
        export: buildExport("export_2"),
        datasetAvailable: true,
        datasetUnavailableReason: null,
        promptTokens: 100,
        completionTokens: 80,
        totalTokens: 180,
        streamSamples: 7,
        completedSamples: 9,
        failedSamples: 1,
        cancelledSamples: 0,
        toolRequestSamples: 4,
        toolResponseSamples: 3,
        systemPromptSamples: 8,
        reasoningSamples: 2,
        metadataSamples: 5,
        explicitSessionSamples: 6,
        previousResponseSamples: 4,
      },
      {
        export: buildExport("export_1"),
        datasetAvailable: false,
        datasetUnavailableReason: "dataset_missing",
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        streamSamples: null,
        completedSamples: null,
        failedSamples: null,
        cancelledSamples: null,
        toolRequestSamples: null,
        toolResponseSamples: null,
        systemPromptSamples: null,
        reasoningSamples: null,
        metadataSamples: null,
        explicitSessionSamples: null,
        previousResponseSamples: null,
      },
    ];

    const report = buildGatewayAnalysisExportTrendReport({
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
      windowSize: 5,
      inventorySummary,
      points,
    });

    assert.equal(report.windowSize, 5);
    assert.equal(report.matchedExportsCount, 2);
    assert.equal(report.points[0]?.export.exportId, "export_2");
    assert.equal(report.points[0]?.totalTokens, 180);
    assert.equal(report.points[1]?.datasetAvailable, false);
    assert.equal(report.points[1]?.datasetUnavailableReason, "dataset_missing");
    assert.equal(report.summary?.latestExportId, "export_2");
    assert.equal(report.summary?.previousExportId, "export_1");
    assert.equal(report.summary?.totalTokensPerSample.latestValue, 18);
    assert.equal(report.summary?.totalTokensPerSample.previousValue, null);
    assert.equal(report.summary?.requestArtifactCoverage.latestValue, 0.9);
    assert.equal(report.summary?.responseArtifactCoverage.latestValue, 0.8);
    assert.equal(report.summary?.completionRate.latestValue, 0.9);
    assert.equal(report.summary?.failureRate.latestValue, 0.1);
    assert.equal(report.summary?.toolRequestRate.latestValue, 0.4);
  });
});
