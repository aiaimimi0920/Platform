import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCallbackAuditRecommendations } from "./operator-callback-analysis";

describe("agent execution operator callback analysis", () => {
  it("returns no recommendations when there are no callbacks", () => {
    const recommendations = buildCallbackAuditRecommendations({
      totalCount: 0,
      byStatus: [],
      byProtocolMatch: [],
      bySecretMatch: [],
      byRejectionCategory: [],
      byRetryability: [],
    });

    assert.deepEqual(recommendations, []);
  });

  it("builds compatibility, duplicate, and rejected recommendations", () => {
    const recommendations = buildCallbackAuditRecommendations({
      totalCount: 12,
      byStatus: [
        { key: "accepted", count: 7 },
        { key: "duplicate", count: 5 },
        { key: "rejected", count: 2 },
      ],
      byProtocolMatch: [
        { key: "current", count: 8 },
        { key: "previous", count: 4 },
      ],
      bySecretMatch: [
        { key: "current", count: 10 },
        { key: "previous", count: 2 },
      ],
      byRejectionCategory: [
        { key: "invalid_signature", count: 2 },
      ],
      byRetryability: [
        { key: "retryable", count: 2 },
      ],
    });

    assert.equal(recommendations.length, 5);
    assert.equal(recommendations[0]?.kind, "inspect_previous_protocol");
    assert.equal(recommendations[0]?.severity, "danger");
    assert.equal(recommendations[1]?.kind, "inspect_previous_secret");
    assert.equal(recommendations[1]?.severity, "warning");
    assert.equal(recommendations[2]?.kind, "inspect_duplicates");
    assert.equal(recommendations[2]?.status, "duplicate");
    assert.equal(recommendations[3]?.kind, "inspect_rejected");
    assert.equal(recommendations[3]?.retryability, "retryable");
    assert.equal(recommendations[4]?.kind, "inspect_rejected");
    assert.equal(recommendations[4]?.status, "rejected");
    assert.equal(recommendations[4]?.rejectionCategory, "invalid_signature");
  });
});
