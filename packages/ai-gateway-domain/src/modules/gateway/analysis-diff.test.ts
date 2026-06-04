import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayAnalysisExportRowView, GatewayPersistedAnalysisExportView } from "@neuro/contracts";

import { buildGatewayAnalysisExportDiff } from "./analysis-diff";

function buildExport(exportId: string, label: string): GatewayPersistedAnalysisExportView {
  return {
    exportId,
    label,
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
    sampleCount: 0,
    requestArtifactCount: 0,
    responseArtifactCount: 0,
    retentionExpiresAt: null,
    cleanedUpAt: null,
    lastCleanupError: null,
    files: [],
    manifest: {
      schemaVersion: 1,
      exportId,
      label,
      createdAt: "2026-04-06T12:00:00.000Z",
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
      sampleCount: 0,
      requestArtifactCount: 0,
      responseArtifactCount: 0,
      files: [],
    },
  };
}

describe("ai-gateway analysis diff", () => {
  it("compares two exports and computes bucket deltas", () => {
    const leftExport = buildExport("export_left", "baseline");
    const rightExport = buildExport("export_right", "candidate");
    const leftRows: GatewayAnalysisExportRowView[] = [
      {
        requestAuditId: "req_1",
        responseId: "resp_1",
        projectId: "project_1",
        sessionId: null,
        providerAccountId: "provider_a",
        protocolFamily: "openai",
        endpointKind: "responses",
        requestedModel: "gpt-5",
        resolvedModel: "gpt-5",
        status: "completed",
        stream: true,
        createdAt: "2026-04-06T12:00:00.000Z",
        completedAt: "2026-04-06T12:00:01.000Z",
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        requestArtifactAvailable: true,
        responseArtifactAvailable: true,
        analysisProfile: null,
        routeTrace: null,
        requestText: null,
        responseText: null,
        requestTextTruncated: false,
        responseTextTruncated: false,
        requestMessages: [],
        requestToolNames: [],
        responseToolNames: [],
      },
      {
        requestAuditId: "req_2",
        responseId: "resp_2",
        projectId: "project_1",
        sessionId: null,
        providerAccountId: "provider_a",
        protocolFamily: "openai",
        endpointKind: "chat_completions",
        requestedModel: "gpt-5-mini",
        resolvedModel: "gpt-5-mini",
        status: "failed",
        stream: false,
        createdAt: "2026-04-06T12:01:00.000Z",
        completedAt: "2026-04-06T12:01:01.000Z",
        promptTokens: 7,
        completionTokens: 0,
        totalTokens: 7,
        requestArtifactAvailable: true,
        responseArtifactAvailable: false,
        analysisProfile: null,
        routeTrace: null,
        requestText: null,
        responseText: null,
        requestTextTruncated: false,
        responseTextTruncated: false,
        requestMessages: [],
        requestToolNames: [],
        responseToolNames: [],
      },
    ];
    const rightRows: GatewayAnalysisExportRowView[] = [
      {
        requestAuditId: "req_1",
        responseId: "resp_1",
        projectId: "project_1",
        sessionId: null,
        providerAccountId: "provider_b",
        protocolFamily: "openai",
        endpointKind: "responses",
        requestedModel: "gpt-5",
        resolvedModel: "gpt-5",
        status: "completed",
        stream: true,
        createdAt: "2026-04-06T12:05:00.000Z",
        completedAt: "2026-04-06T12:05:01.000Z",
        promptTokens: 12,
        completionTokens: 6,
        totalTokens: 18,
        requestArtifactAvailable: true,
        responseArtifactAvailable: true,
        analysisProfile: null,
        routeTrace: null,
        requestText: null,
        responseText: null,
        requestTextTruncated: false,
        responseTextTruncated: false,
        requestMessages: [],
        requestToolNames: [],
        responseToolNames: [],
      },
      {
        requestAuditId: "req_3",
        responseId: "resp_3",
        projectId: "project_1",
        sessionId: null,
        providerAccountId: "provider_b",
        protocolFamily: "anthropic",
        endpointKind: "messages",
        requestedModel: "claude-sonnet",
        resolvedModel: "claude-sonnet",
        status: "completed",
        stream: false,
        createdAt: "2026-04-06T12:06:00.000Z",
        completedAt: "2026-04-06T12:06:01.000Z",
        promptTokens: 8,
        completionTokens: 10,
        totalTokens: 18,
        requestArtifactAvailable: false,
        responseArtifactAvailable: true,
        analysisProfile: null,
        routeTrace: null,
        requestText: null,
        responseText: null,
        requestTextTruncated: false,
        responseTextTruncated: false,
        requestMessages: [],
        requestToolNames: [],
        responseToolNames: [],
      },
    ];

    const diff = buildGatewayAnalysisExportDiff({
      leftExport,
      rightExport,
      leftRows,
      rightRows,
    });

    assert.equal(diff.overlapRequestCount, 1);
    assert.equal(diff.leftOnlyRequestCount, 1);
    assert.equal(diff.rightOnlyRequestCount, 1);
    assert.equal(diff.sampleCount.leftValue, 2);
    assert.equal(diff.sampleCount.rightValue, 2);
    assert.equal(diff.sampleCount.deltaValue, 0);
    assert.equal(diff.totalTokens.leftValue, 22);
    assert.equal(diff.totalTokens.rightValue, 36);
    assert.equal(diff.totalTokens.deltaValue, 14);
    assert.equal(diff.byStatus.find((bucket) => bucket.key === "failed")?.deltaCount, -1);
    assert.equal(diff.byStatus.find((bucket) => bucket.key === "completed")?.deltaCount, 1);
    assert.equal(diff.byProtocolFamily.find((bucket) => bucket.key === "anthropic")?.deltaCount, 1);
    assert.equal(diff.byProviderAccount.find((bucket) => bucket.key === "provider_b")?.rightCount, 2);
  });
});
