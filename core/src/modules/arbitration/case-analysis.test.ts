import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildArbitrationCaseSummary, buildArbitrationTimeline } from "./case-analysis";

describe("arbitration case analysis", () => {
  it("builds a timeline from case lifecycle fields", () => {
    const timeline = buildArbitrationTimeline({
      createdAt: new Date("2026-03-20T08:00:00.000Z"),
      updatedAt: new Date("2026-03-21T08:00:00.000Z"),
      resolvedAt: new Date("2026-03-21T10:00:00.000Z"),
      effectsAppliedAt: new Date("2026-03-21T11:00:00.000Z"),
      reason: "交付物存在争议",
      evidenceSummary: "截图与日志摘要",
      evidences: [],
      resolutionSummary: "裁定任务默认",
      status: "resolved",
    });

    assert.equal(timeline.length, 5);
    assert.equal(timeline[0]?.kind, "created");
    assert.equal(timeline[1]?.kind, "evidence");
    assert.equal(timeline[2]?.kind, "under_review");
    assert.equal(timeline[3]?.kind, "resolved");
    assert.equal(timeline[4]?.kind, "effects_applied");
  });

  it("builds arbitration summary buckets", () => {
    const summary = buildArbitrationCaseSummary([
      {
        entityType: "task",
        status: "open",
        taskResolutionAction: null,
        reputationImpactForViewer: "neutral",
        effectsAppliedAt: null,
        evidences: [],
        assignedOperatorUserId: null,
      },
      {
        entityType: "task",
        status: "resolved",
        taskResolutionAction: "default",
        reputationImpactForViewer: "favorable",
        effectsAppliedAt: "2026-03-21T11:00:00.000Z",
        evidences: [
          {
            id: "e-1",
            caseId: "c-1",
            creatorUserId: "u-1",
            kind: "text_note",
            title: "日志说明",
            content: "补充日志",
            url: null,
            attachments: [],
            createdAt: "2026-03-21T09:00:00.000Z",
          },
        ],
        assignedOperatorUserId: "operator-1",
      },
      {
        entityType: "task",
        status: "rejected",
        taskResolutionAction: null,
        reputationImpactForViewer: "neutral",
        effectsAppliedAt: null,
        evidences: [],
        assignedOperatorUserId: null,
      },
    ]);

    assert.equal(summary.totalCount, 3);
    assert.equal(summary.awaitingOperatorCount, 1);
    assert.equal(summary.resolvedWithEffectsCount, 1);
    assert.equal(summary.evidenceCount, 1);
    assert.equal(summary.casesWithEvidenceCount, 1);
    assert.equal(summary.casesWithoutEvidenceCount, 2);
    assert.equal(summary.claimedCount, 1);
    assert.equal(summary.unclaimedCount, 2);
    assert.equal(summary.byStatus[0]?.key, "open");
    assert.equal(summary.byEntityType[0]?.key, "task");
    assert.equal(summary.byEvidenceKind[0]?.key, "text_note");
  });

  it("prefers structured evidences in the timeline when present", () => {
    const timeline = buildArbitrationTimeline({
      createdAt: new Date("2026-03-20T08:00:00.000Z"),
      updatedAt: new Date("2026-03-20T09:00:00.000Z"),
      resolvedAt: null,
      effectsAppliedAt: null,
      reason: "任务交付结果争议",
      evidenceSummary: "旧证据摘要",
      evidences: [
        {
          id: "evi-1",
          caseId: "case-1",
          creatorUserId: "user-1",
          kind: "external_link",
          title: "外链证据",
          content: null,
          url: "https://example.com/evidence",
          attachments: [],
          createdAt: "2026-03-20T08:30:00.000Z",
        },
      ],
      resolutionSummary: null,
      status: "open",
    });

    assert.equal(timeline.length, 2);
    assert.equal(timeline[1]?.kind, "evidence");
    assert.match(timeline[1]?.detail || "", /外链证据/);
    assert.match(timeline[1]?.detail || "", /https:\/\/example.com\/evidence/);
  });
});
