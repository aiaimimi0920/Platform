import assert from "node:assert/strict";
import test from "node:test";

import type { HeavyChatSnapshot, InternalUserContext } from "@neuro/contracts";

import {
  handleHeavyChatCreateThreadRequest,
  handleHeavyChatSendMessageRequest,
  handleHeavyChatSnapshotRequest,
  loadHeavyChatWorkspace,
} from "./server";

const userContext: InternalUserContext = { userId: "user-1", username: "alice" };
const snapshot: HeavyChatSnapshot = {
  slots: [],
  projects: [],
  slotProjects: [],
  bindings: [],
  threads: [],
  messages: [],
};

test("heavy chat browser server returns a no-store snapshot envelope", async () => {
  const response = await handleHeavyChatSnapshotRequest(new Request("https://platform.local/api/heavy-chat/snapshot"), {
    requireUserContext: async () => userContext,
    getSnapshot: async (context) => {
      assert.deepEqual(context, userContext);
      return snapshot;
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate");
  assert.deepEqual(await response.json(), { snapshot });
});

test("heavy chat browser server rejects invalid create payloads before Core", async () => {
  let calls = 0;
  const response = await handleHeavyChatCreateThreadRequest(
    new Request("https://platform.local/api/heavy-chat/threads", {
      method: "POST",
      body: JSON.stringify({ slotId: "", title: "" }),
    }),
    {
      requireUserContext: async () => userContext,
      createThread: async () => {
        calls += 1;
        return {};
      },
    },
  );

  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("heavy chat browser server preserves Core mutation errors", async () => {
  const response = await handleHeavyChatSendMessageRequest(
    "thread-1",
    new Request("https://platform.local/api/heavy-chat/threads/thread-1/messages", {
      method: "POST",
      body: JSON.stringify({ content: "Hello", idempotencyKey: "send-1" }),
    }),
    {
      requireUserContext: async () => userContext,
      sendMessage: async () => {
        throw new Error("Core mutation failed");
      },
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Heavy chat service is temporarily unavailable" });
});

test("workspace loading returns an explicit unavailable state instead of seed data", async () => {
  const loaded = await loadHeavyChatWorkspace(userContext, {
    getSnapshot: async () => {
      throw new Error("database unavailable");
    },
  });

  assert.deepEqual(loaded.workspace, { slots: [], projects: [], threads: [] });
  assert.equal(loaded.error, "Heavy chat service is temporarily unavailable");
});
