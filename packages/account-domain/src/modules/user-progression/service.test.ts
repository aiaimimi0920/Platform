import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildUserProgressionSnapshot, getUserProgressionAccessRule } from "./model";

describe("buildUserProgressionSnapshot", () => {
  it("accumulates experience from existing engagement signals and resolves the current level", () => {
    const snapshot = buildUserProgressionSnapshot({
      trustLevel: 2,
      metrics: {
        dailyRewardCount: 5,
        dailyMissionCount: 3,
        weeklyMissionCount: 1,
        taskApplicationCount: 2,
        taskCreatedCount: 1,
        taskCompletedCount: 1,
        itemOwnedCount: 2,
        opinionCreatedCount: 1,
        opinionParticipationCount: 4,
        agentCreatedCount: 1,
        agentCapabilityCount: 3,
      },
    });

    assert.equal(snapshot.experience, 446);
    assert.equal(snapshot.level, 3);
    assert.equal(snapshot.title, "协作者");
    assert.equal(snapshot.rewardDiscountRate, 0.05);
    assert.equal(snapshot.experienceToNextLevel, 194);
    assert.equal(snapshot.nextLevelPreview?.level, 4);
    assert.equal(snapshot.sources[0]?.key, "registration");
    assert.equal(snapshot.access.find((item) => item.key === "createOpinionTopic")?.satisfied, true);
    assert.equal(snapshot.access.find((item) => item.key === "createExternalAgent")?.satisfied, true);
  });

  it("caps progress at the highest configured level", () => {
    const snapshot = buildUserProgressionSnapshot({
      trustLevel: 4,
      metrics: {
        dailyRewardCount: 50,
        dailyMissionCount: 20,
        weeklyMissionCount: 8,
        taskApplicationCount: 16,
        taskCreatedCount: 12,
        taskCompletedCount: 10,
        itemOwnedCount: 18,
        opinionCreatedCount: 6,
        opinionParticipationCount: 30,
        agentCreatedCount: 5,
        agentCapabilityCount: 20,
      },
    });

    assert.equal(snapshot.level, 6);
    assert.equal(snapshot.nextLevelPreview, null);
    assert.equal(snapshot.experienceToNextLevel, null);
    assert.equal(snapshot.progressRate, 1);
  });
});

describe("getUserProgressionAccessRule", () => {
  it("marks creation gates as unsatisfied below their configured threshold", () => {
    const rule = getUserProgressionAccessRule(
      {
        level: 1,
        title: "新用户",
      },
      "createOpinionTopic",
    );

    assert.equal(rule.minLevel, 2);
    assert.equal(rule.satisfied, false);
    assert.match(rule.note, /Lv\.2/);
  });
});
