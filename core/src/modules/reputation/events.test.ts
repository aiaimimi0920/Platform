import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTaskLifecycleReputationUpdatedPayload } from "./events";

describe("reputation events", () => {
  it("builds a deduplicated task lifecycle reputation payload", () => {
    const payload = buildTaskLifecycleReputationUpdatedPayload({
      action: "accept",
      taskId: "task-1",
      actorUserId: "user-operator",
      creatorUserId: " user-a ",
      assignedUserId: "user-a",
    });

    assert.deepEqual(payload, {
      trigger: "task_lifecycle",
      action: "accept",
      taskId: "task-1",
      actorUserId: "user-operator",
      userIds: ["user-a"],
    });
  });
});
