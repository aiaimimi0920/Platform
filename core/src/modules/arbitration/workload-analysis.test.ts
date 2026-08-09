import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildArbitrationCaseWorkload } from "./workload-analysis";

const referenceTime = new Date("2026-01-02T12:00:00.000Z");

describe("arbitration workload analysis", () => {
  it("preserves claim, round, stale, assignee, and candidate metrics", () => {
    const workload = buildArbitrationCaseWorkload({
      cases: [
        {
          id: "claimed-a",
          status: "under_review",
          assignedOperatorUserId: "operator-a",
          claimedAt: new Date("2026-01-02T06:30:00.000Z"),
          createdAt: new Date("2026-01-01T01:00:00.000Z"),
        },
        {
          id: "claimed-b",
          status: "open",
          assignedOperatorUserId: "operator-b",
          claimedAt: new Date("2026-01-02T10:30:00.000Z"),
          createdAt: new Date("2026-01-01T02:00:00.000Z"),
        },
        {
          id: "candidate-open",
          status: "open",
          assignedOperatorUserId: null,
          claimedAt: null,
          createdAt: new Date("2026-01-01T03:00:00.000Z"),
        },
        {
          id: "candidate-review",
          status: "under_review",
          assignedOperatorUserId: null,
          claimedAt: null,
          createdAt: new Date("2026-01-01T04:00:00.000Z"),
        },
      ],
      evidenceMetrics: [
        { caseId: "candidate-open", evidenceCount: 3 },
        { caseId: "candidate-review", evidenceCount: 2 },
      ],
      reviewRounds: [
        {
          caseId: "claimed-a",
          roundNumber: 2,
          status: "open",
          assignedOperatorUserId: "operator-a",
          startedAt: new Date("2026-01-02T05:00:00.000Z"),
          endedAt: null,
        },
        {
          caseId: "candidate-open",
          roundNumber: 1,
          status: "open",
          assignedOperatorUserId: null,
          startedAt: new Date("2026-01-02T10:00:00.000Z"),
          endedAt: null,
        },
        {
          caseId: "candidate-review",
          roundNumber: 3,
          status: "completed",
          assignedOperatorUserId: "operator-b",
          startedAt: new Date("2026-01-02T08:00:00.000Z"),
          endedAt: new Date("2026-01-02T09:00:00.000Z"),
        },
      ],
      userId: "operator-a",
      operatorUserIds: ["operator-a", "operator-b", "operator-c"],
      staleClaimHours: 4,
      referenceTime,
      getRoundStaleHours: () => 4,
    });

    assert.equal(workload.claimedCount, 2);
    assert.equal(workload.unclaimedCount, 2);
    assert.equal(workload.mineCount, 1);
    assert.equal(workload.staleClaimedCount, 1);
    assert.equal(workload.staleRoundCount, 1);
    assert.equal(workload.oldestStaleRoundAgeHours, 7);
    assert.equal(workload.unassignedOpenRoundCount, 1);
    assert.deepEqual(workload.byStatus, [
      { key: "under_review", count: 2 },
      { key: "open", count: 2 },
    ]);
    assert.deepEqual(workload.byReviewRoundStatus, [
      { key: "open", count: 2 },
      { key: "completed", count: 1 },
    ]);
    assert.deepEqual(workload.byRoundAgeBucket, [
      { key: "stale", count: 1 },
      { key: "approaching_stale", count: 1 },
    ]);
    assert.equal(workload.byAssignee.find(({ key }) => key === "operator-a")?.avgClaimAgeHours, 5);
    assert.equal(workload.byRoundAssignee.find(({ key }) => key === "operator-a")?.avgRoundAgeHours, 7);
    assert.equal(workload.byRoundAssignee.find(({ key }) => key === "unassigned")?.avgRoundAgeHours, 2);
    assert.equal(workload.recommendedAssigneeUserId, "operator-c");
    assert.deepEqual(workload.nextClaimCandidate, {
      caseId: "candidate-review",
      status: "under_review",
      currentReviewRoundNumber: 3,
      evidenceCount: 2,
      createdAt: "2026-01-01T04:00:00.000Z",
    });
  });

  it("uses round, evidence count, and creation time as stable candidate tie-breakers", () => {
    const workload = buildArbitrationCaseWorkload({
      cases: [
        {
          id: "older",
          status: "under_review",
          assignedOperatorUserId: null,
          claimedAt: null,
          createdAt: new Date("2026-01-01T01:00:00.000Z"),
        },
        {
          id: "more-evidence",
          status: "under_review",
          assignedOperatorUserId: null,
          claimedAt: null,
          createdAt: new Date("2026-01-01T02:00:00.000Z"),
        },
        {
          id: "higher-round",
          status: "under_review",
          assignedOperatorUserId: null,
          claimedAt: null,
          createdAt: new Date("2026-01-01T03:00:00.000Z"),
        },
      ],
      evidenceMetrics: [
        { caseId: "older", evidenceCount: 1 },
        { caseId: "more-evidence", evidenceCount: 2 },
        { caseId: "higher-round", evidenceCount: 1 },
      ],
      reviewRounds: [
        { caseId: "older", roundNumber: 2, status: "open", assignedOperatorUserId: null, startedAt: referenceTime, endedAt: null },
        { caseId: "more-evidence", roundNumber: 2, status: "open", assignedOperatorUserId: null, startedAt: referenceTime, endedAt: null },
        { caseId: "higher-round", roundNumber: 3, status: "open", assignedOperatorUserId: null, startedAt: referenceTime, endedAt: null },
      ],
      userId: "operator-a",
      operatorUserIds: ["operator-a"],
      staleClaimHours: 4,
      referenceTime,
      getRoundStaleHours: () => 4,
    });

    assert.equal(workload.nextClaimCandidate?.caseId, "higher-round");
  });
});
