import assert from "node:assert/strict";
import test from "node:test";

import type { HeavyChatMessagePage, HeavyChatSnapshot } from "@neuro/contracts";

import {
  adaptHeavyChatMessagePage,
  adaptHeavyChatSnapshot,
  mergeHeavyChatMessagePage,
  mergeHeavyChatWorkspaceSnapshot,
} from "./adapter";

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
    messagePages: [{ threadId: "thread-1", hasMore: false, nextBeforeSequence: null }],
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
    messagePages: [{ threadId: "thread-1", hasMore: false, nextBeforeSequence: null }],
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
    messagePages: [{ threadId: "thread-1", hasMore: false, nextBeforeSequence: null }],
  };

  const actions = adaptHeavyChatSnapshot(snapshot).threads[0]?.messages[0]?.actions ?? [];
  assert.deepEqual(actions.map((action) => [action.type, action.status, action.href]), [
    ["task", "complete", "/my-tasks#task-task-1"],
    ["mailbox", "failed", null],
  ]);
  assert.match(actions[1]?.errorMessage ?? "", /temporarily unavailable/i);
});

test("heavy chat adapter prepends keyset pages without duplicating messages", () => {
  const snapshot: HeavyChatSnapshot = {
    slots: [],
    projects: [],
    slotProjects: [],
    bindings: [],
    threads: [{
      id: "thread-1",
      ownerUserId: "user-1",
      slotId: "slot-1",
      projectId: null,
      title: "Paged thread",
      favorite: false,
      sortOrder: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    messages: [
      message("message-3", "user", "complete", 3, "Third"),
      message("message-4", "assistant", "streaming", 4, "Partial"),
    ],
    messagePages: [{ threadId: "thread-1", hasMore: true, nextBeforeSequence: 3 }],
  };
  const page: HeavyChatMessagePage = {
    threadId: "thread-1",
    messages: [
      message("message-1", "user", "complete", 1, "First"),
      message("message-2", "assistant", "complete", 2, "Second"),
      message("message-3", "user", "complete", 3, "Third"),
    ],
    hasMore: false,
    nextBeforeSequence: null,
  };

  const merged = mergeHeavyChatMessagePage(
    adaptHeavyChatSnapshot(snapshot),
    adaptHeavyChatMessagePage(page),
  );

  assert.deepEqual(merged.threads[0]?.messages.map((item) => item.sequence), [1, 2, 3, 4]);
  assert.equal(merged.threads[0]?.hasMoreMessages, false);
  assert.equal(merged.threads[0]?.nextBeforeSequence, null);
});

test("heavy chat snapshot refresh updates live rows while retaining loaded history", () => {
  const base: HeavyChatSnapshot = {
    slots: [],
    projects: [],
    slotProjects: [],
    bindings: [],
    threads: [{
      id: "thread-1",
      ownerUserId: "user-1",
      slotId: "slot-1",
      projectId: null,
      title: "Refresh thread",
      favorite: false,
      sortOrder: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    messages: [message("message-1", "user", "complete", 1, "Loaded earlier")],
    messagePages: [{ threadId: "thread-1", hasMore: false, nextBeforeSequence: null }],
  };
  const current = adaptHeavyChatSnapshot(base);
  const incoming = adaptHeavyChatSnapshot({
    ...base,
    messages: [
      message("message-4", "assistant", "complete", 4, "Final response"),
      message("message-5", "user", "complete", 5, "Latest"),
    ],
    messagePages: [{ threadId: "thread-1", hasMore: true, nextBeforeSequence: 4 }],
  });

  const merged = mergeHeavyChatWorkspaceSnapshot(current, incoming);

  assert.deepEqual(merged.threads[0]?.messages.map((item) => item.sequence), [1, 4, 5]);
  assert.equal(merged.threads[0]?.hasMoreMessages, false);
  assert.equal(merged.threads[0]?.nextBeforeSequence, null);
  assert.match(JSON.stringify(merged.threads[0]?.messages[1]?.blocks), /Final response/);
});
