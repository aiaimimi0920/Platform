import assert from "node:assert/strict";
import test from "node:test";

import { runHeavyChatBrowserAction } from "./browser-action";

test("P2-05 RED: browser action posts only the action type and refreshes persisted state", async () => {
  let capturedPath = "";
  let capturedInit: RequestInit | undefined;
  let refreshCalls = 0;
  const result = await runHeavyChatBrowserAction({
    messageId: "message/1",
    type: "task",
    request: async (pathname, init) => {
      capturedPath = pathname;
      capturedInit = init;
      return {
        result: {
          action: {
            id: "action-1",
            type: "task",
            status: "complete",
            attemptNumber: 1,
            targetId: "task-1",
            errorMessage: null,
            updatedAt: "2026-07-20T08:00:00.000Z",
          },
          target: { id: "task-1", type: "task", href: "/my-tasks#task-task-1" },
          executed: true,
          created: true,
        },
      };
    },
    refresh: async () => {
      refreshCalls += 1;
    },
  });

  assert.equal(capturedPath, "/api/heavy-chat/messages/message%2F1/actions");
  assert.equal(capturedInit?.method, "POST");
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), { type: "task" });
  assert.equal(refreshCalls, 1);
  assert.equal(result.target?.id, "task-1");
});
