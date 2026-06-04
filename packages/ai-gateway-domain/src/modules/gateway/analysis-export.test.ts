import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  GatewayAnalysisExportFilterView,
  GatewayAnalysisExportRowView,
  GatewayAnalysisSampleView,
  GatewayStoredRequestArtifact,
  GatewayStoredResponseArtifact,
} from "@neuro/contracts";

import {
  buildGatewayAnalysisDatasetJsonl,
  buildGatewayAnalysisExportFileView,
  buildGatewayAnalysisExportManifest,
  buildGatewayAnalysisExportRow,
  redactSensitiveText,
} from "./analysis-export";

describe("ai-gateway analysis export helpers", () => {
  it("redacts common secret-like fragments", () => {
    const redacted = redactSensitiveText(
      "Contact dev@example.com with Bearer abcdefghijklmnop and new_api_testtoken?token=secret",
    );

    assert.match(redacted, /\[REDACTED_EMAIL\]/);
    assert.match(redacted, /Bearer \[REDACTED_TOKEN\]/);
    assert.match(redacted, /\[REDACTED_API_KEY\]/);
    assert.match(redacted, /token=\s*\[REDACTED\]/);
  });

  it("builds redacted export rows from stored artifacts", () => {
    const sample: GatewayAnalysisSampleView = {
      requestAuditId: "audit_1",
      responseId: "resp_1",
      projectId: "project_1",
      sessionId: "session_1",
      providerAccountId: "provider_1",
      protocolFamily: "openai",
      endpointKind: "responses",
      requestedModel: "gpt-5-codex",
      resolvedModel: "gpt-5-codex",
      status: "completed",
      stream: true,
      createdAt: "2026-04-06T10:00:00.000Z",
      completedAt: "2026-04-06T10:00:02.000Z",
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      analysisProfile: {
        requestMessageCount: 2,
        requestTextChars: 64,
        requestImageCount: 0,
        requestAttachmentCount: 0,
        requestToolCount: 1,
        requestHistoricalToolCallCount: 0,
        hasSystemPrompt: true,
        hasReasoning: false,
        hasMetadata: true,
        hasExplicitSessionKey: true,
        hasPreviousResponse: false,
        stream: true,
        responseTextChars: 48,
        responseToolCallCount: 1,
        firstTokenLatencyMs: 120,
        streamChunkCount: 4,
        requestTextSha256: "a".repeat(64),
        responseTextSha256: "b".repeat(64),
      },
      requestArtifactObjectKey: "request.json",
      responseArtifactObjectKey: "response.json",
      routeTrace: null,
    };

    const requestArtifact: GatewayStoredRequestArtifact = {
      schemaVersion: 1,
      kind: "request",
      requestAuditId: "audit_1",
      projectId: "project_1",
      sessionId: "session_1",
      protocolFamily: "openai",
      endpointKind: "responses",
      requestedModel: "gpt-5-codex",
      previousResponseId: null,
      explicitSessionKey: "session:session_1",
      analysisProfile: sample.analysisProfile!,
      capturedAt: "2026-04-06T10:00:00.000Z",
      canonicalRequest: {
        protocolFamily: "openai",
        endpointKind: "responses",
        requestedModel: "gpt-5-codex",
        stream: true,
        messages: [
          {
            role: "system",
            content: [{ type: "text", text: "Stay terse." }],
            name: null,
            toolCallId: null,
            toolCalls: [],
          },
          {
            role: "user",
            content: [{ type: "text", text: "Email me at dev@example.com" }],
            name: null,
            toolCallId: null,
            toolCalls: [],
          },
        ],
        tools: [{ type: "function", name: "read_diff", description: null, inputSchema: {}, raw: {} }],
        toolChoice: null,
        reasoning: null,
        metadata: { ticket: "BUG-42" },
        attachments: [],
        previousResponseId: null,
        explicitSessionKey: "session:session_1",
      },
      rawBody: {
        model: "gpt-5-codex",
      },
    };

    const responseArtifact: GatewayStoredResponseArtifact = {
      schemaVersion: 1,
      kind: "response",
      requestAuditId: "audit_1",
      responseId: "resp_1",
      providerAccountId: "provider_1",
      resolvedModel: "gpt-5-codex",
      upstreamStatus: 200,
      status: "completed",
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      result: {
        text: "Use Bearer abcdefghijklmnop for deployment.",
        toolCalls: [{ id: "call-2", type: "function", name: "write_summary", arguments: "{}", raw: {} }],
        upstreamSessionId: "upstream_session_1",
        runtimeStateObjectKey: "runtime/session.json",
      },
      analysisProfile: sample.analysisProfile!,
      routeTrace: null,
      capturedAt: "2026-04-06T10:00:02.000Z",
    };

    const row = buildGatewayAnalysisExportRow({
      sample,
      requestArtifact,
      responseArtifact,
      textMode: "preview_redacted",
      maxTextChars: 80,
    });

    assert.equal(row.requestMessages.length, 2);
    assert.deepEqual(row.requestToolNames, ["read_diff"]);
    assert.deepEqual(row.responseToolNames, ["write_summary"]);
    assert.match(row.requestText ?? "", /\[REDACTED_EMAIL\]/);
    assert.match(row.responseText ?? "", /\[REDACTED_TOKEN\]/);
    assert.equal(row.requestArtifactAvailable, true);
    assert.equal(row.responseArtifactAvailable, true);
  });

  it("builds dataset jsonl and manifest metadata", () => {
    const rows: GatewayAnalysisExportRowView[] = [
      {
        requestAuditId: "audit_1",
        responseId: "resp_1",
        projectId: "project_1",
        sessionId: null,
        providerAccountId: "provider_1",
        protocolFamily: "openai",
        endpointKind: "responses",
        requestedModel: "gpt-5-codex",
        resolvedModel: "gpt-5-codex",
        status: "completed",
        stream: true,
        createdAt: "2026-04-06T10:00:00.000Z",
        completedAt: "2026-04-06T10:00:02.000Z",
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        requestArtifactAvailable: true,
        responseArtifactAvailable: true,
        analysisProfile: null,
        routeTrace: null,
        requestText: "hello",
        responseText: "world",
        requestTextTruncated: false,
        responseTextTruncated: false,
        requestMessages: [],
        requestToolNames: [],
        responseToolNames: [],
      },
    ];
    const filters: GatewayAnalysisExportFilterView = {
      projectId: "project_1",
      providerAccountId: null,
      sessionId: null,
      apiKeyId: null,
      responseId: null,
      protocolFamily: "openai",
      status: "completed",
      endpointKind: null,
      stream: true,
      errorCode: null,
      fallbackEligible: null,
      createdFrom: "2026-04-06T00:00:00.000Z",
      createdTo: "2026-04-06T23:59:59.000Z",
      artifactAvailable: true,
      limit: 100,
      textMode: "preview_redacted",
      maxTextChars: 4000,
    };

    const datasetBody = buildGatewayAnalysisDatasetJsonl([...rows]);
    const datasetFile = buildGatewayAnalysisExportFileView({
      kind: "dataset_jsonl",
      objectKey: "ai-gateway/analysis-exports/export_1/dataset.jsonl",
      contentType: "application/x-ndjson",
      body: datasetBody,
      lineCount: rows.length,
    });
    const manifest = buildGatewayAnalysisExportManifest({
      exportId: "export_1",
      label: "training-window",
      tags: ["gold", "pinned"],
      createdAt: "2026-04-06T10:05:00.000Z",
      retentionExpiresAt: "2026-04-20T10:05:00.000Z",
      filters,
      sampleCount: rows.length,
      requestArtifactCount: 1,
      responseArtifactCount: 1,
      files: [datasetFile],
    });

    assert.equal(datasetBody.toString("utf8").trim().split("\n").length, 1);
    assert.equal(datasetFile.kind, "dataset_jsonl");
    assert.equal(datasetFile.lineCount, 1);
    assert.match(datasetFile.sha256, /^[a-f0-9]{64}$/);
    assert.equal(manifest.exportId, "export_1");
    assert.equal(manifest.label, "training-window");
    assert.deepEqual(manifest.tags, ["gold", "pinned"]);
    assert.equal(manifest.retentionExpiresAt, "2026-04-20T10:05:00.000Z");
    assert.equal(manifest.filters.textMode, "preview_redacted");
    assert.equal(manifest.files[0]?.objectKey, "ai-gateway/analysis-exports/export_1/dataset.jsonl");
  });
});
