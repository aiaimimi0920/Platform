import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFulfillmentOpsRecommendations,
  buildFulfillmentRecentRunWindows,
  filterFulfillmentRuns,
} from "./operator-ops-analysis";

describe("product fulfillment operator analysis", () => {
  const referenceTime = new Date("2026-03-22T12:00:00.000Z");

  it("builds recent run windows from run activity", () => {
    const windows = buildFulfillmentRecentRunWindows(
      [
        {
          id: "run-1",
          itemId: "item-1",
          trigger: "scheduled",
          status: "completed",
          scannedUnits: 12,
          replacementsCreated: 2,
          note: "Active slot gaps were replenished.",
          createdAt: "2026-03-22T10:00:00.000Z",
        },
        {
          id: "run-2",
          itemId: "item-2",
          trigger: "manual",
          status: "noop",
          scannedUnits: 8,
          replacementsCreated: 0,
          note: "No slot gap detected.",
          createdAt: "2026-03-18T10:00:00.000Z",
        },
      ],
      referenceTime,
    );

    assert.equal(windows[0]?.key, "24h");
    assert.equal(windows[0]?.totalCount, 1);
    assert.equal(windows[0]?.scheduledCount, 1);
    assert.equal(windows[0]?.replacementsCreated, 2);
    assert.equal(windows[1]?.key, "7d");
    assert.equal(windows[1]?.totalCount, 2);
    assert.equal(windows[1]?.manualCount, 1);
  });

  it("builds review queue and sweep recommendations", () => {
    const recommendations = buildFulfillmentOpsRecommendations({
      manualReviews: {
        openCount: 4,
        oldestOpenAt: "2026-03-18T10:00:00.000Z",
        oldestOpenAgeHours: 98,
        claimedCount: 1,
        unclaimedCount: 3,
        staleClaimedCount: 0,
        autoReleasedLast24h: 0,
        byReason: [],
        byRoutingCode: [
          { key: "usage_audit_required", count: 2 },
          { key: "high_replacement_frequency", count: 1 },
        ],
        bySuggestedAction: [],
        byPriority: [
          { key: "urgent", count: 2 },
          { key: "high", count: 1 },
        ],
        byAgeBucket: [],
        byClaimState: [{ key: "unclaimed", count: 3 }],
        byClaimAgeBucket: [{ key: "unclaimed", count: 3 }],
        byAssignee: [{ key: "unassigned", count: 3 }],
      },
      recentRunWindows: [
        {
          key: "24h",
          totalCount: 0,
          manualCount: 0,
          scheduledCount: 0,
          replacementRunCount: 0,
          replacementsCreated: 0,
        },
        {
          key: "7d",
          totalCount: 2,
          manualCount: 1,
          scheduledCount: 1,
          replacementRunCount: 1,
          replacementsCreated: 1,
        },
      ],
      latestRunAt: null,
    });

    assert.equal(recommendations.length, 4);
    assert.equal(recommendations[0]?.kind, "focus_urgent_queue");
    assert.equal(recommendations[0]?.severity, "danger");
    assert.equal(recommendations[1]?.kind, "inspect_usage_queue");
    assert.equal(recommendations[2]?.kind, "inspect_pool_health");
    assert.equal(recommendations[3]?.kind, "inspect_sweep_activity");
    assert.equal(recommendations[3]?.severity, "danger");
  });

  it("filters recent runs by trigger and time window", () => {
    const filtered = filterFulfillmentRuns({
      runs: [
        {
          id: "run-1",
          itemId: "item-1",
          trigger: "scheduled",
          status: "completed",
          scannedUnits: 12,
          replacementsCreated: 1,
          note: null,
          createdAt: "2026-03-22T11:00:00.000Z",
        },
        {
          id: "run-2",
          itemId: "item-2",
          trigger: "manual",
          status: "noop",
          scannedUnits: 6,
          replacementsCreated: 0,
          note: null,
          createdAt: "2026-03-15T11:00:00.000Z",
        },
      ],
      runTrigger: "scheduled",
      runWindow: "24h",
      referenceTime,
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, "run-1");
  });
});
