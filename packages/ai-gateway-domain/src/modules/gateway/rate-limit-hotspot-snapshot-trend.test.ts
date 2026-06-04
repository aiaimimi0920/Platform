import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayRateLimitHotspotSnapshotView } from "@neuro/contracts";

import {
  buildGatewayRateLimitHotspotSnapshotTrendPoint,
  buildGatewayRateLimitHotspotSnapshotTrendReport,
} from "./rate-limit-hotspot-snapshot-trend";
import { buildGatewayRateLimitHotspotSnapshotInventorySummary } from "./rate-limit-hotspot-snapshot-inventory";

function createSnapshot(overrides: Partial<GatewayRateLimitHotspotSnapshotView> = {}): GatewayRateLimitHotspotSnapshotView {
  return {
    snapshotId: "snapshot-1",
    label: "daily",
    createdAt: "2026-04-07T12:00:00.000Z",
    objectKey: "ai-gateway/rate-limit-hotspot-snapshots/snapshot-1/snapshot.json",
    filters: {
      projectId: null,
      routePolicyId: null,
      providerAccountId: null,
      sessionId: null,
      apiKeyId: null,
      responseId: null,
      protocolFamily: null,
      endpointKind: null,
      errorCode: null,
      createdFrom: null,
      createdTo: null,
      limit: 1000,
      lookbackHours: 24,
    },
    summary: {
      totalRateLimitedRequests: 10,
      byCode: [{ key: "rate_limit_exceeded_api_key", count: 8 }],
      byProject: [{ key: "project-a", count: 7 }],
      byRoutePolicyId: [{ key: "policy-a", count: 10 }],
      byApiKeyId: [{ key: "key-a", count: 8 }],
      byRequestedModel: [{ key: "gpt-4o", count: 6 }],
      byResolvedModel: [{ key: "gpt-4o", count: 6 }],
      byEndpointKind: [{ key: "responses", count: 9 }],
    },
    ...overrides,
  };
}

describe("gateway rate limit hotspot snapshot trend report", () => {
  it("summarizes latest versus previous snapshot points", () => {
    const snapshots = [
      createSnapshot(),
      createSnapshot({
        snapshotId: "snapshot-2",
        createdAt: "2026-04-06T12:00:00.000Z",
        summary: {
          totalRateLimitedRequests: 4,
          byCode: [{ key: "rate_limit_exceeded_project", count: 2 }],
          byProject: [{ key: "project-b", count: 2 }],
          byRoutePolicyId: [{ key: "policy-b", count: 4 }],
          byApiKeyId: [{ key: "key-b", count: 2 }],
          byRequestedModel: [{ key: "gpt-4.1", count: 2 }],
          byResolvedModel: [{ key: "gpt-4.1", count: 2 }],
          byEndpointKind: [{ key: "chat.completions", count: 3 }],
        },
      }),
    ];

    const report = buildGatewayRateLimitHotspotSnapshotTrendReport({
      generatedAt: "2026-04-07T13:00:00.000Z",
      filters: {
        label: null,
        projectId: null,
        routePolicyId: null,
        apiKeyId: null,
        endpointKind: null,
        createdFrom: null,
        createdTo: null,
      },
      windowSize: 10,
      inventorySummary: buildGatewayRateLimitHotspotSnapshotInventorySummary({ snapshots }),
      points: snapshots.map((snapshot) => buildGatewayRateLimitHotspotSnapshotTrendPoint(snapshot)),
    });

    assert.equal(report.matchedSnapshotsCount, 2);
    assert.equal(report.points[0].totalRateLimitedRequests, 10);
    assert.equal(report.points[0].topCodeShare, 0.8);
    assert.equal(report.summary?.latestSnapshotId, "snapshot-1");
    assert.equal(report.summary?.totalRateLimitedRequests.latestValue, 10);
    assert.equal(report.summary?.totalRateLimitedRequests.previousValue, 4);
    assert.equal(report.summary?.topEndpointShare.latestValue, 0.9);
  });
});
