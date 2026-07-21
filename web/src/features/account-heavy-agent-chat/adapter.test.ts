import assert from "node:assert/strict";
import test from "node:test";

import type { HeavyChatSnapshot } from "@neuro/contracts";

import { adaptHeavyChatSnapshot } from "./adapter";

const timestamp = "2026-07-19T08:00:00.000Z";

function message(
  id: string,
  role: "user" | "assistant" | "system",
  status: "pending" | "streaming" | "complete" | "failed",
  sequence: number,
  content: string,
): HeavyChatSnapshot["messages"][number] {
  return {
    id,
    ownerUserId: "user-1",
    threadId: "thread-1",
    role,
    status,
    sequence,
    attemptNumber: role === "assistant" ? 1 : 0,
    content,
    references: [],
    actions: [],
    idempotencyKey: null,
    errorCode: status === "failed" ? "unavailable" : null,
    errorMessage: status === "failed" ? "Gateway is unavailable" : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

test("heavy chat adapter maps persisted snapshot relationships without seed data", () => {
  const snapshot: HeavyChatSnapshot = {
    slots: [
      {
        id: "slot-1",
        ownerUserId: "user-1",
        slotKey: "mimi",
        kind: "default",
        title: "Mimi",
        personaLabel: "Default",
        summary: "Persistent slot",
        sortOrder: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    projects: [
      {
        id: "project-1",
        ownerUserId: "user-1",
        title: "Delivery",
        subtitle: "Persistent project",
        instructions: "Use persisted context",
        sortOrder: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    slotProjects: [{ slotId: "slot-1", projectId: "project-1" }],
    bindings: [
      {
        id: "binding-1",
        ownerUserId: "user-1",
        slotId: "slot-1",
        agentId: "agent-1",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    threads: [
      {
        id: "thread-1",
        ownerUserId: "user-1",
        slotId: "slot-1",
        projectId: "project-1",
        title: "Persisted thread",
        favorite: true,
        sortOrder: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    messages: [message("message-user", "user", "complete", 1, "Persisted question")],
  };

  const result = adaptHeavyChatSnapshot(snapshot, new Date("2026-07-19T09:00:00.000Z"));

  assert.deepEqual(result.slots[0]?.projectIds, ["project-1"]);
  assert.equal(result.slots[0]?.occupied, true);
  assert.equal(result.projects[0]?.instructions, "Use persisted context");
  assert.equal(result.threads[0]?.title, "Persisted thread");
  assert.equal(result.threads[0]?.preview, "Persisted question");
  assert.equal(result.threads[0]?.messages[0]?.blocks[0]?.type, "text");
});

test("heavy chat adapter maps Core execution statuses to visible UI states", () => {
  const snapshot: HeavyChatSnapshot = {
    slots: [],
    projects: [],
    slotProjects: [],
    bindings: [],
    threads: [
      {
        id: "thread-1",
        ownerUserId: "user-1",
        slotId: "slot-1",
        projectId: null,
        title: "Status thread",
        favorite: false,
        sortOrder: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    messages: [
      message("message-pending", "assistant", "pending", 1, ""),
      message("message-streaming", "assistant", "streaming", 2, "Partial"),
      message("message-complete", "assistant", "complete", 3, "Complete"),
      message("message-failed", "assistant", "failed", 4, ""),
    ],
  };

  const result = adaptHeavyChatSnapshot(snapshot, new Date("2026-07-19T09:00:00.000Z"));
  const messages = result.threads[0]?.messages ?? [];

  assert.deepEqual(messages.map((item) => item.status), ["streaming", "streaming", "complete", "error"]);
  assert.equal(messages[3]?.blocks[0]?.type, "status");
  assert.match(JSON.stringify(messages[3]?.blocks), /Gateway is unavailable/);
  assert.equal(result.threads[0]?.preview, "Gateway is unavailable");
});

test("P2-05 RED: heavy chat adapter restores persisted action state and target links", () => {
  const assistant = message("message-action", "assistant", "complete", 1, "Action result");
  assistant.actions = [
    {
      id: "action-task",
      type: "task",
      status: "complete",
      attemptNumber: 1,
      targetId: "task-1",
      errorMessage: null,
      updatedAt: timestamp,
    },
    {
      id: "action-mailbox",
      type: "mailbox",
      status: "failed",
      attemptNumber: 2,
      targetId: "mail-1",
      errorMessage: "Mailbox temporarily unavailable",
      updatedAt: timestamp,
    },
  ];
  const snapshot: HeavyChatSnapshot = {
    slots: [],
    projects: [],
    slotProjects: [],
    bindings: [],
    threads: [
      {
        id: "thread-1",
        ownerUserId: "user-1",
        slotId: "slot-1",
        projectId: null,
        title: "Action thread",
        favorite: false,
        sortOrder: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    messages: [assistant],
  };

  const actions = adaptHeavyChatSnapshot(snapshot).threads[0]?.messages[0]?.actions ?? [];
  assert.deepEqual(actions.map((action) => [action.type, action.status, action.href]), [
    ["task", "complete", "/my-tasks#task-task-1"],
    ["mailbox", "failed", null],
  ]);
  assert.match(actions[1]?.errorMessage ?? "", /temporarily unavailable/i);
});
