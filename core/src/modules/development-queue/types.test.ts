import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canTransitionDevelopmentQueueStatus,
  developmentQueueStatusOrder,
  toDevelopmentQueueItemView,
} from "./types";

describe("development queue transitions", () => {
  it("accepts only configured forward transitions", () => {
    assert.equal(canTransitionDevelopmentQueueStatus("queued", "planned"), true);
    assert.equal(canTransitionDevelopmentQueueStatus("planned", "completed"), false);
    assert.equal(canTransitionDevelopmentQueueStatus("archived", "queued"), false);
  });

  it("keeps the status ordering stable for roadmap sorting", () => {
    assert.equal(developmentQueueStatusOrder.in_progress < developmentQueueStatusOrder.planned, true);
    assert.equal(developmentQueueStatusOrder.planned < developmentQueueStatusOrder.archived, true);
  });
});

describe("toDevelopmentQueueItemView", () => {
  it("normalizes numeric support rates and respects archived status", () => {
    const queuedAt = new Date("2026-03-22T00:00:00.000Z");
    const updatedAt = new Date("2026-03-22T01:00:00.000Z");
    const archivedAt = new Date("2026-03-22T02:00:00.000Z");
    const item: Parameters<typeof toDevelopmentQueueItemView>[0] = {
      id: "dq_1",
      sourceType: "opinionTopic",
      sourceId: "topic_1",
      ownerUserId: "usr_1",
      title: "Queue item",
      description: "A mapped queue item",
      difficultyLevel: 3,
      supportTicketTotal: 42,
      opposeTicketTotal: 5,
      supportRate: "0.66666",
      priorityScore: 88,
      status: "archived",
      queuedAt,
      startedAt: null,
      deliveredAt: null,
      archivedAt,
      updatedAt,
    };

    const view = toDevelopmentQueueItemView(item, true);

    assert.equal(view.supportRate, 0.6667);
    assert.equal(view.canUpdateStatus, false);
    assert.equal(view.archivedAt, archivedAt.toISOString());
    assert.equal(view.queuedAt, queuedAt.toISOString());
  });
});
