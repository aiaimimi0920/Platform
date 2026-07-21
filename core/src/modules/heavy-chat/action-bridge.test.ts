import assert from "node:assert/strict";
import test from "node:test";

import type { HeavyChatAction, HeavyChatActionType } from "@neuro/contracts";

import {
  createHeavyChatActionBridge,
  HeavyChatActionExecutionError,
} from "./action-bridge";
import { HeavyChatActionConflictError, type HeavyChatMessageRecord } from "./types";

type PersistedAction = HeavyChatAction & {
  attemptNumber: number;
  updatedAt: string;
};

const NOW = new Date("2026-07-20T08:00:00.000Z");

function assistantMessage(overrides: Partial<HeavyChatMessageRecord> = {}): HeavyChatMessageRecord {
  return {
    id: "message-1",
    ownerUserId: "owner-a",
    threadId: "thread-1",
    role: "assistant",
    status: "complete",
    sequence: 2,
    attemptNumber: 1,
    content: "Prepare a concrete launch checklist for the Platform release.",
    references: [],
    actions: [],
    idempotencyKey: null,
    errorCode: null,
    errorMessage: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createActionRepository(initialMessage = assistantMessage()) {
  let message = structuredClone(initialMessage);

  function actionById(actionId: string) {
    return message.actions.find((candidate) => candidate.id === actionId) as PersistedAction | undefined;
  }

  return {
    repository: {
      async findMessageById(ownerUserId: string, messageId: string) {
        return ownerUserId === message.ownerUserId && messageId === message.id
          ? structuredClone(message)
          : null;
      },
      async reserveMessageAction(
        ownerUserId: string,
        messageId: string,
        type: HeavyChatActionType,
      ) {
        if (ownerUserId !== message.ownerUserId || messageId !== message.id) {
          throw new Error("message does not belong to owner");
        }
        const existing = message.actions.find((candidate) => candidate.type === type) as PersistedAction | undefined;
        if (existing?.status === "complete" || existing?.status === "pending") {
          return { action: structuredClone(existing), message: structuredClone(message), claimed: false };
        }
        const action: PersistedAction = existing
          ? {
              ...existing,
              status: "pending",
              attemptNumber: existing.attemptNumber + 1,
              errorMessage: null,
              updatedAt: NOW.toISOString(),
            }
          : {
              id: `heavy-chat-action:${message.id}:${type}`,
              type,
              status: "pending",
              attemptNumber: 1,
              targetId: null,
              errorMessage: null,
              updatedAt: NOW.toISOString(),
            };
        message.actions = [...message.actions.filter((candidate) => candidate.type !== type), action];
        return { action: structuredClone(action), message: structuredClone(message), claimed: true };
      },
      async completeMessageAction(
        ownerUserId: string,
        messageId: string,
        actionId: string,
        expectedAttemptNumber: number,
        targetId: string,
      ) {
        if (ownerUserId !== message.ownerUserId || messageId !== message.id) {
          throw new Error("message does not belong to owner");
        }
        const current = actionById(actionId);
        if (!current || current.attemptNumber !== expectedAttemptNumber) {
          throw new HeavyChatActionConflictError("action attempt changed");
        }
        const action: PersistedAction = {
          ...current,
          status: "complete",
          targetId,
          errorMessage: null,
          updatedAt: NOW.toISOString(),
        };
        message.actions = message.actions.map((candidate) => candidate.id === actionId ? action : candidate);
        return { action: structuredClone(action), message: structuredClone(message) };
      },
      async failMessageAction(
        ownerUserId: string,
        messageId: string,
        actionId: string,
        expectedAttemptNumber: number,
        input: { errorMessage: string; targetId?: string | null },
      ) {
        if (ownerUserId !== message.ownerUserId || messageId !== message.id) {
          throw new Error("message does not belong to owner");
        }
        const current = actionById(actionId);
        if (!current || current.attemptNumber !== expectedAttemptNumber) {
          throw new HeavyChatActionConflictError("action attempt changed");
        }
        const action: PersistedAction = {
          ...current,
          status: "failed",
          targetId: input.targetId ?? current.targetId ?? null,
          errorMessage: input.errorMessage,
          updatedAt: NOW.toISOString(),
        };
        message.actions = message.actions.map((candidate) => candidate.id === actionId ? action : candidate);
        return { action: structuredClone(action), message: structuredClone(message) };
      },
    },
    getMessage() {
      return structuredClone(message);
    },
  };
}

function createTargetServices() {
  const taskDrafts = new Map<string, { id: string; ownerUserId: string; description: string }>();
  const mailboxMessages = new Map<string, { id: string; ownerUserId: string; body: string }>();
  let taskCreateCalls = 0;
  let mailboxCreateCalls = 0;

  return {
    taskHub: {
      async createTaskDraft(ownerUserId: string, input: { idempotencyKey: string; description: string }) {
        taskCreateCalls += 1;
        const existing = taskDrafts.get(input.idempotencyKey);
        if (existing) return { task: existing, created: false };
        const task = { id: "task-draft-1", ownerUserId, description: input.description };
        taskDrafts.set(input.idempotencyKey, task);
        return { task, created: true };
      },
      async getOwnedTaskSummary(ownerUserId: string, taskId: string) {
        return [...taskDrafts.values()].find((task) => task.ownerUserId === ownerUserId && task.id === taskId) ?? null;
      },
    },
    mailbox: {
      async createMailboxMessage(input: { userId: string; idempotencyKey?: string | null; body: string }) {
        mailboxCreateCalls += 1;
        const key = input.idempotencyKey || "";
        const existing = mailboxMessages.get(key);
        if (existing) return { messageId: existing.id, created: false };
        const mailboxMessage = { id: "mailbox-message-1", ownerUserId: input.userId, body: input.body };
        mailboxMessages.set(key, mailboxMessage);
        return { messageId: mailboxMessage.id, created: true };
      },
      async getMailboxMessageById(ownerUserId: string, messageId: string) {
        return [...mailboxMessages.values()].find(
          (mailboxMessage) => mailboxMessage.ownerUserId === ownerUserId && mailboxMessage.id === messageId,
        ) ?? null;
      },
    },
    counts() {
      return { taskCreateCalls, mailboxCreateCalls };
    },
    taskDrafts,
    mailboxMessages,
  };
}

test("P2-05: task action creates, verifies, and persists one owner task draft", async () => {
  const { repository, getMessage } = createActionRepository();
  const targets = createTargetServices();
  const bridge = createHeavyChatActionBridge({ repository, taskHub: targets.taskHub, mailbox: targets.mailbox, now: () => NOW });

  const result = await bridge.runAction("owner-a", { messageId: "message-1", type: "task" });

  assert.equal(targets.counts().taskCreateCalls, 1);
  assert.equal(result.action.status, "complete");
  assert.equal(result.action.targetId, "task-draft-1");
  assert.equal(result.executed, true);
  assert.deepEqual(result.target, {
    id: "task-draft-1",
    type: "task",
    href: "/my-tasks#task-task-draft-1",
  });
  assert.equal((getMessage().actions[0] as PersistedAction).attemptNumber, 1);
});

test("P2-05 RED: disabled downstream modules are rejected before action reservation", async () => {
  const base = createActionRepository();
  let reserveCalls = 0;
  const repository = {
    ...base.repository,
    async reserveMessageAction(...args: Parameters<typeof base.repository.reserveMessageAction>) {
      reserveCalls += 1;
      return base.repository.reserveMessageAction(...args);
    },
  };
  const bridge = createHeavyChatActionBridge({
    repository,
    taskHub: {
      ...createTargetServices().taskHub,
    },
    mailbox: createTargetServices().mailbox,
    assertEnabled: async () => {
      throw new Error("taskHub is disabled");
    },
  });

  await assert.rejects(
    () => bridge.runAction("owner-a", { messageId: "message-1", type: "task" }),
    /taskHub is disabled/,
  );
  assert.equal(reserveCalls, 0);
});

test("P2-05: mailbox action creates a queryable stash exactly once", async () => {
  const { repository } = createActionRepository();
  const targets = createTargetServices();
  const bridge = createHeavyChatActionBridge({ repository, taskHub: targets.taskHub, mailbox: targets.mailbox, now: () => NOW });

  const first = await bridge.runAction("owner-a", { messageId: "message-1", type: "mailbox" });
  const replay = await bridge.runAction("owner-a", { messageId: "message-1", type: "mailbox" });

  assert.equal(targets.counts().mailboxCreateCalls, 1);
  assert.equal(first.action.status, "complete");
  assert.equal(replay.action.targetId, first.action.targetId);
  assert.equal(replay.executed, false);
  assert.equal(first.target?.href, "/mailbox?messageId=mailbox-message-1");
});

test("P2-05: concurrent duplicate action requests claim only one downstream execution", async () => {
  const { repository } = createActionRepository();
  const targets = createTargetServices();
  let releaseCreate = () => {};
  const createGate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  const taskHub = {
    ...targets.taskHub,
    async createTaskDraft(ownerUserId: string, input: { idempotencyKey: string; description: string }) {
      await createGate;
      return targets.taskHub.createTaskDraft(ownerUserId, input);
    },
  };
  const bridge = createHeavyChatActionBridge({ repository, taskHub, mailbox: targets.mailbox, now: () => NOW });

  const firstPromise = bridge.runAction("owner-a", { messageId: "message-1", type: "task" });
  void firstPromise.catch(() => {});
  const replay = await bridge.runAction("owner-a", { messageId: "message-1", type: "task" });
  releaseCreate();
  const first = await firstPromise;

  assert.equal(targets.counts().taskCreateCalls, 1);
  assert.equal(first.executed, true);
  assert.equal(replay.executed, false);
  assert.equal(replay.action.status, "pending");
  assert.equal(replay.target, null);
});

test("P2-05: an unqueryable target fails the action and remains retryable", async () => {
  const { repository, getMessage } = createActionRepository();
  const targets = createTargetServices();
  let queryAvailable = false;
  const taskHub = {
    ...targets.taskHub,
    async getOwnedTaskSummary(ownerUserId: string, taskId: string) {
      return queryAvailable ? targets.taskHub.getOwnedTaskSummary(ownerUserId, taskId) : null;
    },
  };
  const bridge = createHeavyChatActionBridge({ repository, taskHub, mailbox: targets.mailbox, now: () => NOW });

  await assert.rejects(
    () => bridge.runAction("owner-a", { messageId: "message-1", type: "task" }),
    /task draft action failed/i,
  );
  const failed = getMessage().actions[0] as PersistedAction;
  assert.equal(failed.status, "failed");
  assert.equal(failed.targetId, "task-draft-1");

  queryAvailable = true;
  const retry = await bridge.runAction("owner-a", { messageId: "message-1", type: "task" });
  assert.equal(targets.counts().taskCreateCalls, 1);
  assert.equal(retry.action.status, "complete");
  assert.equal((getMessage().actions[0] as PersistedAction).attemptNumber, 2);
});

test("P2-05: stale reclaim fencing does not replace the original downstream error", async () => {
  const { repository, getMessage } = createActionRepository();
  const targets = createTargetServices();
  const taskHub = {
    ...targets.taskHub,
    async createTaskDraft() {
      const current = getMessage().actions[0] as PersistedAction;
      await repository.failMessageAction(
        "owner-a",
        "message-1",
        current.id,
        current.attemptNumber,
        { errorMessage: "reclaimed" },
      );
      await repository.reserveMessageAction("owner-a", "message-1", "task");
      throw new Error("downstream creation failed");
    },
  };
  const bridge = createHeavyChatActionBridge({ repository, taskHub, mailbox: targets.mailbox, now: () => NOW });

  await assert.rejects(
    () => bridge.runAction("owner-a", { messageId: "message-1", type: "task" }),
    (error: unknown) => {
      assert.ok(error instanceof HeavyChatActionExecutionError);
      assert.match(error.sourceError instanceof Error ? error.sourceError.message : "", /downstream creation failed/);
      return true;
    },
  );
  assert.equal((getMessage().actions[0] as PersistedAction).attemptNumber, 2);
});

test("P2-05: owner and message-state denials do not call downstream services", async () => {
  const foreign = createActionRepository();
  const incomplete = createActionRepository(assistantMessage({ status: "failed" }));
  const targets = createTargetServices();
  const foreignBridge = createHeavyChatActionBridge({ repository: foreign.repository, taskHub: targets.taskHub, mailbox: targets.mailbox });
  const incompleteBridge = createHeavyChatActionBridge({ repository: incomplete.repository, taskHub: targets.taskHub, mailbox: targets.mailbox });

  await assert.rejects(
    () => foreignBridge.runAction("owner-b", { messageId: "message-1", type: "task" }),
    /does not belong to the owner/i,
  );
  await assert.rejects(
    () => incompleteBridge.runAction("owner-a", { messageId: "message-1", type: "mailbox" }),
    /completed assistant message/i,
  );
  assert.deepEqual(targets.counts(), { taskCreateCalls: 0, mailboxCreateCalls: 0 });
});

test("P2-05 RED: action failures persist only a stable user-safe message", async () => {
  const { repository, getMessage } = createActionRepository();
  const targets = createTargetServices();
  const secret = "postgres://user:super-secret@10.0.0.9/platform";
  const bridge = createHeavyChatActionBridge({
    repository,
    taskHub: {
      ...targets.taskHub,
      async createTaskDraft() {
        throw new Error(`ECONNREFUSED ${secret} relation=tasks`);
      },
    },
    mailbox: targets.mailbox,
  });

  await assert.rejects(
    () => bridge.runAction("owner-a", { messageId: "message-1", type: "task" }),
    (error: unknown) => {
      assert.match(error instanceof Error ? error.message : "", /task draft action failed/i);
      assert.doesNotMatch(error instanceof Error ? error.message : "", /super-secret|10\.0\.0\.9/);
      return true;
    },
  );
  const persisted = getMessage().actions[0] as PersistedAction;
  assert.match(persisted.errorMessage ?? "", /task draft action failed/i);
  assert.doesNotMatch(persisted.errorMessage ?? "", /super-secret|10\.0\.0\.9|postgres:\/\//i);
});
