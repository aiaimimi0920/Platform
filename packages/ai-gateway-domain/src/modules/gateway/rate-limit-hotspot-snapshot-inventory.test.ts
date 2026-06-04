import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayRateLimitHotspotSnapshotView } from "@neuro/contracts";

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
      totalRateLimitedRequests: 5,
      byCode: [{ key: "rate_limit_exceeded_api_key", count: 5 }],
      byProject: [{ key: "project-a", count: 5 }],
      byRoutePolicyId: [{ key: "policy-a", count: 5 }],
      byApiKeyId: [{ key: "key-a", count: 5 }],
      byRequestedModel: [{ key: "gpt-4o", count: 5 }],
      byResolvedModel: [{ key: "gpt-4o", count: 5 }],
      byEndpointKind: [{ key: "responses", count: 5 }],
    },
    ...overrides,
  };
}

describe("gateway rate limit hotspot snapshot inventory summary", () => {
  it("aggregates persisted snapshot buckets", () => {
    const summary = buildGatewayRateLimitHotspotSnapshotInventorySummary({
      snapshots: [
        createSnapshot(),
        createSnapshot({
          snapshotId: "snapshot-2",
          label: "weekly",
          summary: {
            totalRateLimitedRequests: 2,
            byCode: [{ key: "rate_limit_exceeded_model", count: 2 }],
            byProject: [{ key: "project-b", count: 2 }],
            byRoutePolicyId: [{ key: "policy-b", count: 2 }],
            byApiKeyId: [{ key: "key-b", count: 2 }],
            byRequestedModel: [{ key: "gpt-4.1", count: 2 }],
            byResolvedModel: [{ key: "gpt-4.1", count: 2 }],
            byEndpointKind: [{ key: "chat.completions", count: 2 }],
          },
        }),
      ],
    });

    assert.equal(summary.totalSnapshots, 2);
    assert.equal(summary.totalRateLimitedRequests, 7);
    assert.equal(summary.byCode.find((bucket) => bucket.key === "rate_limit_exceeded_api_key")?.count, 5);
    assert.equal(summary.byProject.find((bucket) => bucket.key === "project-b")?.count, 2);
    assert.equal(summary.byLabel.find((bucket) => bucket.key === "daily")?.count, 1);
    assert.equal(summary.byLabel.find((bucket) => bucket.key === "weekly")?.count, 1);
  });
});
