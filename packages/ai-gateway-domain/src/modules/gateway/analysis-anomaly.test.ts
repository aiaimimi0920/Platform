import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayAnalysisExportTrendReportView, GatewayPersistedAnalysisExportView } from "@neuro/contracts";

import {
  buildGatewayAnalysisExportAnomalyReport,
  buildGatewayAnalysisExportAnomalyThresholdConfig,
} from "./analysis-anomaly";

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
    requestArtifactCount: 10,
    responseArtifactCount: 10,
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
      requestArtifactCount: 10,
      responseArtifactCount: 10,
      files: [],
    },
  };
}

describe("ai-gateway analysis anomaly report", () => {
  it("flags major regressions in latest trend summary", () => {
    const trendReport: GatewayAnalysisExportTrendReportView = {
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
      matchedExportsCount: 2,
      windowSize: 10,
      inventorySummary: {
        totalExports: 2,
        activeExports: 2,
        deletedExports: 0,
        pinnedExports: 0,
        expiringWithin24Hours: 0,
        expiredActiveExports: 0,
        totalSampleCount: 20,
        totalRequestArtifactCount: 16,
        totalResponseArtifactCount: 12,
        byStatus: [{ key: "active", count: 2 }],
        byTextMode: [{ key: "preview_redacted", count: 2 }],
        byTag: [{ key: "rolling", count: 2 }],
        byProject: [{ key: "project_1", count: 2 }],
      },
      points: [
        {
          export: buildExport("export_latest"),
          datasetAvailable: true,
          datasetUnavailableReason: null,
          promptTokens: 1000,
          completionTokens: 900,
          totalTokens: 1900,
          streamSamples: 7,
          completedSamples: 7,
          failedSamples: 3,
          cancelledSamples: 0,
          toolRequestSamples: 3,
          toolResponseSamples: 2,
          systemPromptSamples: 8,
          reasoningSamples: 1,
          metadataSamples: 4,
          explicitSessionSamples: 6,
          previousResponseSamples: 2,
        },
        {
          export: buildExport("export_previous"),
          datasetAvailable: true,
          datasetUnavailableReason: null,
          promptTokens: 700,
          completionTokens: 500,
          totalTokens: 1200,
          streamSamples: 8,
          completedSamples: 9,
          failedSamples: 1,
          cancelledSamples: 0,
          toolRequestSamples: 2,
          toolResponseSamples: 2,
          systemPromptSamples: 8,
          reasoningSamples: 1,
          metadataSamples: 4,
          explicitSessionSamples: 6,
          previousResponseSamples: 2,
        },
      ],
      summary: {
        latestExportId: "export_latest",
        previousExportId: "export_previous",
        promptTokensPerSample: { latestValue: 100, previousValue: 70, deltaValue: 30, deltaRatio: 30 / 70 },
        completionTokensPerSample: { latestValue: 90, previousValue: 50, deltaValue: 40, deltaRatio: 40 / 50 },
        totalTokensPerSample: { latestValue: 190, previousValue: 120, deltaValue: 70, deltaRatio: 70 / 120 },
        requestArtifactCoverage: { latestValue: 0.7, previousValue: 1, deltaValue: -0.3, deltaRatio: -0.3 },
        responseArtifactCoverage: { latestValue: 0.5, previousValue: 1, deltaValue: -0.5, deltaRatio: -0.5 },
        streamRate: { latestValue: 0.7, previousValue: 0.8, deltaValue: -0.1, deltaRatio: -0.125 },
        completionRate: { latestValue: 0.7, previousValue: 0.9, deltaValue: -0.2, deltaRatio: -0.2 / 0.9 },
        failureRate: { latestValue: 0.3, previousValue: 0.1, deltaValue: 0.2, deltaRatio: 2 },
        cancellationRate: { latestValue: 0, previousValue: 0, deltaValue: 0, deltaRatio: null },
        toolRequestRate: { latestValue: 0.3, previousValue: 0.2, deltaValue: 0.1, deltaRatio: 0.5 },
        toolResponseRate: { latestValue: 0.2, previousValue: 0.2, deltaValue: 0, deltaRatio: 0 },
        reasoningRate: { latestValue: 0.1, previousValue: 0.1, deltaValue: 0, deltaRatio: 0 },
        metadataRate: { latestValue: 0.4, previousValue: 0.4, deltaValue: 0, deltaRatio: 0 },
        explicitSessionRate: { latestValue: 0.6, previousValue: 0.6, deltaValue: 0, deltaRatio: 0 },
        previousResponseRate: { latestValue: 0.2, previousValue: 0.2, deltaValue: 0, deltaRatio: 0 },
      },
    };

    const report = buildGatewayAnalysisExportAnomalyReport({
      trendReport,
      profileKey: "balanced",
      thresholds: buildGatewayAnalysisExportAnomalyThresholdConfig("balanced"),
    });

    assert.equal(report.latestExport?.exportId, "export_latest");
    assert.equal(report.previousExport?.exportId, "export_previous");
    assert.equal(report.profileKey, "balanced");
    assert.ok(report.bySeverity.some((item) => item.key === "critical"));
    assert.ok(report.byCode.some((item) => item.key === "failure_rate_spike"));
    assert.ok(report.anomalies.some((item) => item.code === "failure_rate_spike"));
    assert.ok(report.anomalies.some((item) => item.code === "completion_rate_drop"));
    assert.ok(report.anomalies.some((item) => item.code === "response_artifact_coverage_drop"));
    assert.ok(report.anomalies.some((item) => item.code === "request_artifact_coverage_drop"));
    assert.ok(report.anomalies.some((item) => item.code === "tokens_per_sample_spike"));
  });
});
