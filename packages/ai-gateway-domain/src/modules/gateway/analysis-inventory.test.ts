import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayPersistedAnalysisExportView } from "@neuro/contracts";

import { buildGatewayAnalysisExportInventorySummary } from "./analysis-inventory";

function buildExport(args: Partial<GatewayPersistedAnalysisExportView> & { exportId: string }): GatewayPersistedAnalysisExportView {
  return {
    exportId: args.exportId,
    label: args.label ?? null,
    tags: args.tags ?? [],
    status: args.status ?? "active",
    createdAt: args.createdAt ?? "2026-04-06T00:00:00.000Z",
    updatedAt: args.updatedAt ?? "2026-04-06T00:00:00.000Z",
    objectPrefix: args.objectPrefix ?? `ai-gateway/analysis-exports/${args.exportId}`,
    filters: args.filters ?? {
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
    sampleCount: args.sampleCount ?? 0,
    requestArtifactCount: args.requestArtifactCount ?? 0,
    responseArtifactCount: args.responseArtifactCount ?? 0,
    retentionExpiresAt: args.retentionExpiresAt ?? null,
    cleanedUpAt: args.cleanedUpAt ?? null,
    lastCleanupError: args.lastCleanupError ?? null,
    files: args.files ?? [],
    manifest: args.manifest ?? {
      schemaVersion: 1,
      exportId: args.exportId,
      label: args.label ?? null,
      tags: args.tags ?? [],
      createdAt: args.createdAt ?? "2026-04-06T00:00:00.000Z",
      retentionExpiresAt: args.retentionExpiresAt ?? null,
      filters: (args.filters ?? {
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
      }),
      sampleCount: args.sampleCount ?? 0,
      requestArtifactCount: args.requestArtifactCount ?? 0,
      responseArtifactCount: args.responseArtifactCount ?? 0,
      files: args.files ?? [],
    },
  };
}

describe("ai-gateway analysis export inventory summary", () => {
  it("aggregates export inventory with pinned and expiry signals", () => {
    const summary = buildGatewayAnalysisExportInventorySummary({
      nowIso: "2026-04-06T12:00:00.000Z",
      exports: [
        buildExport({
          exportId: "export_1",
          tags: ["gold", "pinned"],
          sampleCount: 10,
          requestArtifactCount: 9,
          responseArtifactCount: 8,
          retentionExpiresAt: "2026-04-06T13:00:00.000Z",
        }),
        buildExport({
          exportId: "export_2",
          filters: {
            projectId: "project_2",
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
            textMode: "full",
            maxTextChars: 32000,
          },
          status: "deleted",
          tags: ["gold"],
          sampleCount: 4,
          requestArtifactCount: 4,
          responseArtifactCount: 4,
          cleanedUpAt: "2026-04-06T11:00:00.000Z",
        }),
        buildExport({
          exportId: "export_3",
          retentionExpiresAt: "2026-04-06T11:00:00.000Z",
          sampleCount: 3,
          requestArtifactCount: 2,
          responseArtifactCount: 2,
        }),
      ],
    });

    assert.equal(summary.totalExports, 3);
    assert.equal(summary.activeExports, 2);
    assert.equal(summary.deletedExports, 1);
    assert.equal(summary.pinnedExports, 1);
    assert.equal(summary.expiringWithin24Hours, 1);
    assert.equal(summary.expiredActiveExports, 1);
    assert.equal(summary.totalSampleCount, 17);
    assert.equal(summary.byTag.find((bucket) => bucket.key === "gold")?.count, 2);
    assert.equal(summary.byProject.find((bucket) => bucket.key === "project_1")?.count, 2);
    assert.equal(summary.byTextMode.find((bucket) => bucket.key === "preview_redacted")?.count, 2);
  });
});
