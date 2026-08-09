import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import {
  createHeavyChatRepository,
  type HeavyChatStore,
} from "./repository";
import {
  heavyChatMessages,
  heavyChatSlotProjects,
  heavyChatThreads,
} from "./schema";
import type {
  HeavyChatMessageAttemptRecord,
  HeavyChatMessageRecord,
  HeavyChatProjectRecord,
  HeavyChatSlotAgentBindingRecord,
  HeavyChatSlotProjectRecord,
  HeavyChatSlotRecord,
  HeavyChatThreadRecord,
} from "./types";
import {
  HeavyChatActionConflictError,
  HeavyChatAttemptConflictError,
  HeavyChatInvalidTransitionError,
  HeavyChatOwnershipError,
  HeavyChatSlotLimitError,
} from "./types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

class MemoryHeavyChatStore {
  slots: HeavyChatSlotRecord[] = [];
  slotAgentBindings: HeavyChatSlotAgentBindingRecord[] = [];
  projects: HeavyChatProjectRecord[] = [];
  bindings: HeavyChatSlotProjectRecord[] = [];
  threads: HeavyChatThreadRecord[] = [];
  messages: HeavyChatMessageRecord[] = [];
  messageAttempts: HeavyChatMessageAttemptRecord[] = [];
  transactionCount = 0;
  listProjectsForSlotCount = 0;
  failNextMessageInsert = false;

  async transaction<T>(fn: (tx: MemoryHeavyChatStore) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const snapshot = {
      slots: clone(this.slots),
      slotAgentBindings: clone(this.slotAgentBindings),
      projects: clone(this.projects),
      bindings: clone(this.bindings),
      threads: clone(this.threads),
      messages: clone(this.messages),
      messageAttempts: clone(this.messageAttempts),
    };
    try {
      return await fn(this);
    } catch (error) {
      this.slots = snapshot.slots;
      this.slotAgentBindings = snapshot.slotAgentBindings;
      this.projects = snapshot.projects;
      this.bindings = snapshot.bindings;
      this.threads = snapshot.threads;
      this.messages = snapshot.messages;
      this.messageAttempts = snapshot.messageAttempts;
      throw error;
    }
  }

  async findSlotByKey(ownerUserId: string, slotKey: string) {
    return clone(this.slots.find((row) => row.ownerUserId === ownerUserId && row.slotKey === slotKey) ?? null);
  }

  async findSlotById(ownerUserId: string, id: string) {
    return clone(this.slots.find((row) => row.ownerUserId === ownerUserId && row.id === id) ?? null);
  }

  async listSlots(ownerUserId: string) {
    return clone(
      this.slots
        .filter((row) => row.ownerUserId === ownerUserId)
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.createdAt.getTime() - right.createdAt.getTime() ||
            left.id.localeCompare(right.id),
        ),
    );
  }

  async countSlots(ownerUserId: string) {
    return this.slots.filter((row) => row.ownerUserId === ownerUserId).length;
  }

  async insertSlot(row: HeavyChatSlotRecord) {
    this.slots.push(clone(row));
    return clone(row);
  }

  async findSlotAgentBySlot(ownerUserId: string, slotId: string) {
    return clone(
      this.slotAgentBindings.find(
        (row) => row.ownerUserId === ownerUserId && row.slotId === slotId,
      ) ?? null,
    );
  }

  async findSlotAgentByAgent(ownerUserId: string, agentId: string) {
    return clone(
      this.slotAgentBindings.find(
        (row) => row.ownerUserId === ownerUserId && row.agentId === agentId,
      ) ?? null,
    );
  }

  async insertSlotAgent(row: HeavyChatSlotAgentBindingRecord) {
    if (
      this.slotAgentBindings.some(
        (existing) =>
          existing.ownerUserId === row.ownerUserId &&
          (existing.slotId === row.slotId || existing.agentId === row.agentId),
      )
    ) {
      throw new Error("Heavy chat slot or agent is already bound");
    }
    this.slotAgentBindings.push(clone(row));
    return clone(row);
  }

  async findProjectById(ownerUserId: string, id: string) {
    return clone(this.projects.find((row) => row.ownerUserId === ownerUserId && row.id === id) ?? null);
  }

  async listProjects(ownerUserId: string) {
    return clone(
      this.projects
        .filter((row) => row.ownerUserId === ownerUserId)
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.createdAt.getTime() - right.createdAt.getTime() ||
            left.id.localeCompare(right.id),
        ),
    );
  }

  async listProjectsForSlot(ownerUserId: string, slotId: string) {
    this.listProjectsForSlotCount += 1;
    const projectMap = new Map(
      this.projects
        .filter((row) => row.ownerUserId === ownerUserId)
        .map((row) => [row.id, row] as const),
    );
    return clone(
      this.bindings
        .filter((row) => row.ownerUserId === ownerUserId && row.slotId === slotId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
        .map((binding) => projectMap.get(binding.projectId))
        .filter((project): project is HeavyChatProjectRecord => Boolean(project)),
    );
  }

  async insertProject(row: HeavyChatProjectRecord) {
    this.projects.push(clone(row));
    return clone(row);
  }

  async findSlotProject(ownerUserId: string, slotId: string, projectId: string) {
    return clone(
      this.bindings.find(
        (row) => row.ownerUserId === ownerUserId && row.slotId === slotId && row.projectId === projectId,
      ) ?? null,
    );
  }

  async listSlotProjects(ownerUserId: string, slotId: string) {
    return clone(
      this.bindings
        .filter((row) => row.ownerUserId === ownerUserId && row.slotId === slotId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id)),
    );
  }

  async insertSlotProject(row: HeavyChatSlotProjectRecord) {
    this.bindings.push(clone(row));
    return clone(row);
  }

  async findThreadById(ownerUserId: string, id: string) {
    return clone(this.threads.find((row) => row.ownerUserId === ownerUserId && row.id === id) ?? null);
  }

  async listThreads(ownerUserId: string, slotId?: string) {
    return clone(
      this.threads
        .filter((row) => row.ownerUserId === ownerUserId && (!slotId || row.slotId === slotId))
        .sort(
          (left, right) =>
            Number(right.favorite) - Number(left.favorite) ||
            right.updatedAt.getTime() - left.updatedAt.getTime() ||
            right.createdAt.getTime() - left.createdAt.getTime() ||
            left.id.localeCompare(right.id),
        ),
    );
  }

  async insertThread(row: HeavyChatThreadRecord) {
    this.threads.push(clone(row));
    return clone(row);
  }

  async updateThread(ownerUserId: string, id: string, patch: Partial<HeavyChatThreadRecord>) {
    const index = this.threads.findIndex((row) => row.ownerUserId === ownerUserId && row.id === id);
    if (index < 0) return null;
    this.threads[index] = { ...this.threads[index], ...clone(patch) };
    return clone(this.threads[index]);
  }

  async maxMessageSequence(ownerUserId: string, threadId: string) {
    return this.messages
      .filter((row) => row.ownerUserId === ownerUserId && row.threadId === threadId)
      .reduce((max, row) => Math.max(max, row.sequence), 0);
  }

  async findMessageById(ownerUserId: string, id: string) {
    return clone(this.messages.find((row) => row.ownerUserId === ownerUserId && row.id === id) ?? null);
  }

  async findMessageByIdempotencyKey(ownerUserId: string, key: string) {
    return clone(
      this.messages.find((row) => row.ownerUserId === ownerUserId && row.idempotencyKey === key) ?? null,
    );
  }

  async insertMessage(row: HeavyChatMessageRecord) {
    if (this.failNextMessageInsert) {
      this.failNextMessageInsert = false;
      throw new Error("simulated message insert failure");
    }
    this.messages.push(clone(row));
    return clone(row);
  }

  async updateMessage(ownerUserId: string, id: string, patch: Partial<HeavyChatMessageRecord>) {
    const index = this.messages.findIndex((row) => row.ownerUserId === ownerUserId && row.id === id);
    if (index < 0) return null;
    this.messages[index] = { ...this.messages[index], ...clone(patch) };
    return clone(this.messages[index]);
  }

  async updateMessageIfStatus(
    ownerUserId: string,
    id: string,
    currentStatus: HeavyChatMessageRecord["status"],
    patch: Partial<HeavyChatMessageRecord>,
  ) {
    const index = this.messages.findIndex(
      (row) => row.ownerUserId === ownerUserId && row.id === id && row.status === currentStatus,
    );
    if (index < 0) return null;
    this.messages[index] = { ...this.messages[index], ...clone(patch) };
    return clone(this.messages[index]);
  }

  async updateMessageIfStatusAndAttempt(
    ownerUserId: string,
    id: string,
    currentStatus: HeavyChatMessageRecord["status"],
    attemptNumber: number,
    patch: Partial<HeavyChatMessageRecord>,
  ) {
    const index = this.messages.findIndex(
      (row) =>
        row.ownerUserId === ownerUserId &&
        row.id === id &&
        row.status === currentStatus &&
        row.attemptNumber === attemptNumber,
    );
    if (index < 0) return null;
    this.messages[index] = { ...this.messages[index], ...clone(patch) };
    return clone(this.messages[index]);
  }

  async listMessages(ownerUserId: string, threadId: string) {
    return clone(
      this.messages
        .filter((row) => row.ownerUserId === ownerUserId && row.threadId === threadId)
        .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id)),
    );
  }

  async maxMessageAttemptNumber(ownerUserId: string, messageId: string) {
    return this.messageAttempts
      .filter((row) => row.ownerUserId === ownerUserId && row.messageId === messageId)
      .reduce((max, row) => Math.max(max, row.attemptNumber), 0);
  }

  async findMessageAttemptByIdempotencyKey(ownerUserId: string, key: string) {
    return clone(
      this.messageAttempts.find(
        (row) => row.ownerUserId === ownerUserId && row.idempotencyKey === key,
      ) ?? null,
    );
  }

  async insertMessageAttempt(row: HeavyChatMessageAttemptRecord) {
    if (
      this.messageAttempts.some(
        (existing) =>
          existing.ownerUserId === row.ownerUserId &&
          (existing.idempotencyKey === row.idempotencyKey ||
            (existing.messageId === row.messageId && existing.attemptNumber === row.attemptNumber)),
      )
    ) {
      throw new Error("Heavy chat message attempt already exists");
    }
    this.messageAttempts.push(clone(row));
    return clone(row);
  }
}

function buildRepository(options: { now?: () => Date; store?: MemoryHeavyChatStore } = {}) {
  const store = options.store ?? new MemoryHeavyChatStore();
  let id = 0;
  const repository = createHeavyChatRepository({
    store: store as unknown as HeavyChatStore,
    now: options.now ?? (() => new Date("2026-07-19T00:00:00.000Z")),
    createId: () => `generated-${++id}`,
  });
  return { repository, store };
}

test("default Mimi slot is idempotent and isolated by owner", async () => {
  const { repository, store } = buildRepository();
  const first = await repository.createOrGetDefaultSlot("owner-a");
  const second = await repository.createOrGetDefaultSlot("owner-a");
  const other = await repository.createOrGetDefaultSlot("owner-b");

  assert.equal(first.id, second.id);
  assert.equal(first.kind, "default");
  assert.equal(first.title, "觅觅");
  assert.notEqual(first.id, other.id);
  assert.equal((await repository.listSlots("owner-a")).length, 1);
  assert.deepEqual(await repository.listSlots("unknown-owner"), []);
  assert.ok(store.transactionCount >= 3);
});

test("custom slots enforce the total slot entitlement", async () => {
  const { repository } = buildRepository();
  await repository.createOrGetDefaultSlot("owner-a");
  await repository.createCustomSlot("owner-a", { title: "Research", slotKey: "research" });

  await assert.rejects(
    () => repository.createCustomSlot("owner-a", { title: "Blocked" }),
    (error: unknown) => error instanceof HeavyChatSlotLimitError,
  );

  const expanded = await repository.createCustomSlot("owner-a", {
    title: "Expanded",
    maxSlots: 3,
  });
  assert.equal(expanded.kind, "custom");
  await assert.rejects(
    () => repository.createCustomSlot("owner-a", { title: "Invalid", maxSlots: 0 }),
    (error: unknown) => error instanceof HeavyChatSlotLimitError,
  );
});

test("concurrent custom slot creation cannot exceed the owner entitlement", async () => {
  const { repository } = buildRepository();
  await repository.createOrGetDefaultSlot("owner-a");

  const results = await Promise.allSettled([
    repository.createCustomSlot("owner-a", { title: "Research", slotKey: "research" }),
    repository.createCustomSlot("owner-a", { title: "Writing", slotKey: "writing" }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.ok(
    results.some(
      (result) => result.status === "rejected" && result.reason instanceof HeavyChatSlotLimitError,
    ),
  );
  assert.equal((await repository.listSlots("owner-a")).length, 2);
});

test("list operations use ids as deterministic tie breakers", async () => {
  const { repository, store } = buildRepository();
  const timestamp = new Date("2026-07-19T00:00:00.000Z");
  const slotBase = {
    ownerUserId: "owner-a",
    kind: "custom" as const,
    title: "Slot",
    personaLabel: null,
    summary: null,
    sortOrder: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.slots = [
    { ...slotBase, id: "slot-z", slotKey: "slot-z" },
    { ...slotBase, id: "slot-a", slotKey: "slot-a" },
  ];
  const projectBase = {
    ownerUserId: "owner-a",
    title: "Project",
    subtitle: null,
    instructions: null,
    sortOrder: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.projects = [
    { ...projectBase, id: "project-z" },
    { ...projectBase, id: "project-a" },
  ];
  store.bindings = [
    {
      id: "binding-z",
      ownerUserId: "owner-a",
      slotId: "slot-a",
      projectId: "project-z",
      createdAt: timestamp,
    },
    {
      id: "binding-a",
      ownerUserId: "owner-a",
      slotId: "slot-a",
      projectId: "project-a",
      createdAt: timestamp,
    },
  ];
  const threadBase = {
    ownerUserId: "owner-a",
    slotId: "slot-a",
    projectId: null,
    title: "Thread",
    favorite: false,
    sortOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.threads = [
    { ...threadBase, id: "thread-z" },
    { ...threadBase, id: "thread-a" },
  ];

  assert.deepEqual(
    (await repository.listSlots("owner-a")).map((slot) => slot.id),
    ["slot-a", "slot-z"],
  );
  assert.deepEqual(
    (await repository.listProjects("owner-a")).map((project) => project.id),
    ["project-a", "project-z"],
  );
  assert.deepEqual(
    (await repository.listProjectsForSlot("owner-a", "slot-a")).map((project) => project.id),
    ["project-a", "project-z"],
  );
  assert.deepEqual(
    (await repository.listThreads("owner-a", "slot-a")).map((thread) => thread.id),
    ["thread-a", "thread-z"],
  );
});

test("projects, bindings, and threads retain owner scope and deterministic ordering", async () => {
  const { repository, store } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const firstProject = await repository.createProject("owner-a", {
    id: "project-a-2",
    title: "Later",
    sortOrder: 2,
  });
  const secondProject = await repository.createProject("owner-a", {
    id: "project-a-1",
    title: "First",
    sortOrder: 1,
  });
  await repository.bindProjectToSlot("owner-a", slot.id, firstProject.id);
  const repeatedBinding = await repository.bindProjectToSlot("owner-a", slot.id, firstProject.id);
  await repository.bindProjectToSlot("owner-a", slot.id, secondProject.id);

  assert.equal(repeatedBinding.slotId, slot.id);
  assert.deepEqual(
    (await repository.listProjects("owner-a")).map((project) => project.id),
    [secondProject.id, firstProject.id],
  );
  assert.deepEqual(
    (await repository.listProjectsForSlot("owner-a", slot.id)).map((project) => project.id),
    [firstProject.id, secondProject.id],
  );
  assert.equal(store.listProjectsForSlotCount, 1);
  assert.deepEqual(await repository.listProjects("owner-b"), []);
  const otherSlot = await repository.createOrGetDefaultSlot("owner-b");
  await assert.rejects(
    () => repository.bindProjectToSlot("owner-b", otherSlot.id, firstProject.id),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );
  await assert.rejects(
    () => repository.createThread("owner-b", { slotId: slot.id, title: "Cross owner" }),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );
  const unboundProject = await repository.createProject("owner-a", {
    id: "project-unbound",
    title: "Unbound",
  });
  await assert.rejects(
    () =>
      repository.createThread("owner-a", {
        slotId: slot.id,
        projectId: unboundProject.id,
        title: "Unbound project thread",
      }),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );

  const older = await repository.createThread("owner-a", {
    id: "thread-older",
    slotId: slot.id,
    projectId: firstProject.id,
    title: "Older",
    createdAt: new Date("2026-07-18T00:00:00.000Z"),
  });
  const newer = await repository.createThread("owner-a", {
    id: "thread-newer",
    slotId: slot.id,
    projectId: secondProject.id,
    title: "Newer",
    createdAt: new Date("2026-07-19T00:00:00.000Z"),
  });
  assert.deepEqual(
    (await repository.listThreads("owner-a", slot.id)).map((thread) => thread.id),
    [newer.id, older.id],
  );
  assert.equal((await repository.setThreadFavorite("owner-a", older.id, true)).favorite, true);
  assert.deepEqual(
    (await repository.listThreads("owner-a", slot.id)).map((thread) => thread.id),
    [older.id, newer.id],
  );
  await assert.rejects(
    () => repository.setThreadFavorite("owner-b", older.id, false),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );
  assert.equal(await repository.findThreadById("owner-b", older.id), null);
});

test("messages are ordered, idempotent per owner, transactional, and stateful", async () => {
  const { repository, store } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-a",
    slotId: slot.id,
    title: "Conversation",
  });
  const userMessage = await repository.appendMessage("owner-a", {
    id: "message-user",
    threadId: thread.id,
    role: "user",
    content: "Hello",
    idempotencyKey: "request-1",
  });
  const repeated = await repository.appendMessage("owner-a", {
    id: "message-duplicate-must-not-win",
    threadId: thread.id,
    role: "user",
    content: "Different payload",
    idempotencyKey: "request-1",
  });
  assert.equal(repeated.id, userMessage.id);
  assert.equal(repeated.sequence, 1);

  const assistant = await repository.appendMessage("owner-a", {
    id: "message-assistant",
    threadId: thread.id,
    role: "assistant",
    status: "pending",
    content: "",
  });
  assert.equal(assistant.sequence, 2);
  assert.deepEqual(
    (await repository.listMessages("owner-a", thread.id)).map((message) => message.id),
    [userMessage.id, assistant.id],
  );
  assert.equal((await repository.findMessageByIdempotencyKey("owner-b", "request-1")), null);
  assert.deepEqual(await repository.listMessages("owner-b", thread.id), []);

  const streaming = await repository.transitionMessage("owner-a", assistant.id, "streaming", {
    content: "partial",
  });
  assert.equal(streaming.status, "streaming");
  const complete = await repository.transitionMessage("owner-a", assistant.id, "complete", {
    content: "done",
  });
  assert.equal(complete.status, "complete");
  await assert.rejects(
    () => repository.transitionMessage("owner-a", assistant.id, "streaming"),
    (error: unknown) => error instanceof HeavyChatInvalidTransitionError,
  );

  const failedAssistant = await repository.appendMessage("owner-a", {
    id: "message-failed-assistant",
    threadId: thread.id,
    role: "assistant",
    status: "failed",
    errorCode: "provider_timeout",
  });
  const retryingAssistant = await repository.transitionMessage("owner-a", failedAssistant.id, "pending", {
    errorCode: null,
    errorMessage: null,
  });
  assert.equal(retryingAssistant.status, "pending");
  assert.equal(retryingAssistant.errorCode, null);

  store.failNextMessageInsert = true;
  await assert.rejects(() =>
    repository.appendMessage("owner-a", {
      id: "message-rollback",
      threadId: thread.id,
      role: "assistant",
      status: "pending",
    }),
  );
  assert.equal(await repository.findMessageById("owner-a", "message-rollback"), null);
});

test("concurrent message appends preserve idempotency and allocate unique sequences", async () => {
  const { repository } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-concurrent",
    slotId: slot.id,
    title: "Concurrent conversation",
  });

  const repeated = await Promise.all([
    repository.appendMessage("owner-a", {
      id: "message-idempotent-a",
      threadId: thread.id,
      role: "user",
      content: "first payload",
      idempotencyKey: "concurrent-request",
    }),
    repository.appendMessage("owner-a", {
      id: "message-idempotent-b",
      threadId: thread.id,
      role: "user",
      content: "second payload",
      idempotencyKey: "concurrent-request",
    }),
  ]);

  assert.equal(repeated[0].id, repeated[1].id);
  assert.equal((await repository.listMessages("owner-a", thread.id)).length, 1);

  const distinct = await Promise.all([
    repository.appendMessage("owner-a", {
      id: "message-distinct-a",
      threadId: thread.id,
      role: "assistant",
      status: "pending",
    }),
    repository.appendMessage("owner-a", {
      id: "message-distinct-b",
      threadId: thread.id,
      role: "assistant",
      status: "pending",
    }),
  ]);
  assert.deepEqual(
    distinct.map((message) => message.sequence).sort((left, right) => left - right),
    [2, 3],
  );
});

test("concurrent message transitions cannot reverse a terminal state", async () => {
  const { repository } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-transition",
    slotId: slot.id,
    title: "Transition conversation",
  });
  const message = await repository.appendMessage("owner-a", {
    id: "message-transition",
    threadId: thread.id,
    role: "assistant",
    status: "pending",
  });

  const results = await Promise.allSettled([
    repository.transitionMessage("owner-a", message.id, "complete", { content: "done" }),
    repository.transitionMessage("owner-a", message.id, "streaming", { content: "late partial" }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.ok(
    results.some(
      (result) => result.status === "rejected" && result.reason instanceof HeavyChatInvalidTransitionError,
    ),
  );
  assert.equal((await repository.findMessageById("owner-a", message.id))?.status, "complete");
});

test("message append and transition refresh the parent thread activity time", async () => {
  const { repository } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-activity",
    slotId: slot.id,
    title: "Activity conversation",
    createdAt: new Date("2026-07-18T00:00:00.000Z"),
  });
  const appendedAt = new Date("2026-07-19T01:00:00.000Z");
  const message = await repository.appendMessage("owner-a", {
    id: "message-activity",
    threadId: thread.id,
    role: "assistant",
    status: "pending",
    createdAt: appendedAt,
  });
  assert.equal((await repository.findThreadById("owner-a", thread.id))?.updatedAt.toISOString(), appendedAt.toISOString());

  const transitionedAt = new Date("2026-07-19T02:00:00.000Z");
  await repository.transitionMessage("owner-a", message.id, "complete", {
    content: "done",
    updatedAt: transitionedAt,
  });
  assert.equal(
    (await repository.findThreadById("owner-a", thread.id))?.updatedAt.toISOString(),
    transitionedAt.toISOString(),
  );
});

test("existing threads can be rebound only to projects bound to their slot", async () => {
  const { repository } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const otherSlot = await repository.createCustomSlot("owner-a", {
    title: "Other slot",
    slotKey: "other-slot",
    maxSlots: 3,
  });
  const firstProject = await repository.createProject("owner-a", { id: "project-first", title: "First" });
  const secondProject = await repository.createProject("owner-a", { id: "project-second", title: "Second" });
  const unboundProject = await repository.createProject("owner-a", { id: "project-unbound", title: "Unbound" });
  await repository.bindProjectToSlot("owner-a", slot.id, firstProject.id);
  await repository.bindProjectToSlot("owner-a", slot.id, secondProject.id);
  await repository.bindProjectToSlot("owner-a", otherSlot.id, unboundProject.id);
  const thread = await repository.createThread("owner-a", {
    id: "thread-rebind",
    slotId: slot.id,
    projectId: firstProject.id,
    title: "Rebind conversation",
  });

  const rebound = await repository.rebindProject("owner-a", thread.id, secondProject.id);
  assert.equal(rebound.projectId, secondProject.id);
  const unbound = await repository.bindProjectToThread("owner-a", thread.id, null);
  assert.equal(unbound.projectId, null);
  await assert.rejects(
    () => repository.rebindProject("owner-a", thread.id, unboundProject.id),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );
  await assert.rejects(
    () => repository.rebindProject("owner-b", thread.id, secondProject.id),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );
});

test("slot-agent bindings are owner-scoped, idempotent, and one-to-one", async () => {
  const { repository } = buildRepository();
  const ownerSlot = await repository.createOrGetDefaultSlot("owner-a");
  const otherOwnerSlot = await repository.createOrGetDefaultSlot("owner-b");
  const slotAgentRepository = repository as typeof repository & {
    bindAgentToSlot(ownerUserId: string, slotId: string, agentId: string): Promise<{
      id: string;
      ownerUserId: string;
      slotId: string;
      agentId: string;
    }>;
    findAgentBindingForSlot(ownerUserId: string, slotId: string): Promise<{
      id: string;
      ownerUserId: string;
      slotId: string;
      agentId: string;
    } | null>;
  };

  const first = await slotAgentRepository.bindAgentToSlot("owner-a", ownerSlot.id, "agent-a");
  const repeated = await slotAgentRepository.bindAgentToSlot("owner-a", ownerSlot.id, "agent-a");

  assert.equal(first.id, repeated.id);
  assert.equal(first.agentId, "agent-a");
  assert.equal(
    (await slotAgentRepository.findAgentBindingForSlot("owner-a", ownerSlot.id))?.agentId,
    "agent-a",
  );
  assert.equal(await slotAgentRepository.findAgentBindingForSlot("owner-b", ownerSlot.id), null);
  await assert.rejects(
    () => slotAgentRepository.bindAgentToSlot("owner-b", ownerSlot.id, "agent-a"),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );
  await assert.rejects(
    () => slotAgentRepository.bindAgentToSlot("owner-a", ownerSlot.id, "agent-b"),
    /already bound/i,
  );
  assert.equal(
    (await slotAgentRepository.findAgentBindingForSlot("owner-b", otherOwnerSlot.id))?.agentId ?? null,
    null,
  );
});

test("message attempts reserve retries idempotently without duplicating dispatch", async () => {
  const { repository } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-attempts",
    slotId: slot.id,
    title: "Retry attempts",
  });
  const message = await repository.appendMessage("owner-a", {
    id: "message-attempts",
    threadId: thread.id,
    role: "assistant",
    status: "failed",
    errorCode: "provider_timeout",
  });
  const attemptRepository = repository as typeof repository & {
    reserveMessageAttempt(ownerUserId: string, messageId: string, idempotencyKey: string): Promise<{
      attempt: {
        id: string;
        ownerUserId: string;
        messageId: string;
        idempotencyKey: string;
        attemptNumber: number;
      };
      message: HeavyChatMessageRecord;
      created: boolean;
    }>;
  };

  const first = await attemptRepository.reserveMessageAttempt("owner-a", message.id, "retry-request-1");
  const replay = await attemptRepository.reserveMessageAttempt("owner-a", message.id, "retry-request-1");

  assert.equal(first.created, true);
  assert.equal(first.attempt.attemptNumber, 1);
  assert.equal(first.message.status, "pending");
  assert.equal(replay.created, false);
  assert.equal(replay.attempt.id, first.attempt.id);
  await assert.rejects(
    () => attemptRepository.reserveMessageAttempt("owner-a", message.id, "retry-request-parallel"),
    /already has a pending/i,
  );

  await repository.transitionMessage("owner-a", message.id, "failed", {
    errorCode: "provider_timeout",
  });
  const staleReplay = await attemptRepository.reserveMessageAttempt("owner-a", message.id, "retry-request-1");
  assert.equal(staleReplay.created, false);
  assert.equal(staleReplay.message.status, "failed");

  const second = await attemptRepository.reserveMessageAttempt("owner-a", message.id, "retry-request-2");
  assert.equal(second.created, true);
  assert.equal(second.attempt.attemptNumber, 2);
  assert.equal(second.message.status, "pending");

  await assert.rejects(
    () => attemptRepository.reserveMessageAttempt("owner-b", message.id, "retry-request-owner-b"),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );
});

test("attempt-aware transitions reject stale writes after a retry starts", async () => {
  const { repository } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-attempt-cas",
    slotId: slot.id,
    title: "Attempt CAS",
  });
  const assistant = await repository.appendMessage("owner-a", {
    id: "message-attempt-cas",
    threadId: thread.id,
    role: "assistant",
    status: "pending",
    idempotencyKey: "assistant-attempt-cas",
  });

  const first = await repository.reserveMessageAttempt("owner-a", assistant.id, "attempt-cas-1");
  await repository.transitionMessage("owner-a", assistant.id, "failed", {
    expectedAttemptNumber: first.attempt.attemptNumber,
    errorCode: "provider_timeout",
  });
  const second = await repository.reserveMessageAttempt("owner-a", assistant.id, "attempt-cas-2");
  await repository.transitionMessage("owner-a", assistant.id, "complete", {
    expectedAttemptNumber: second.attempt.attemptNumber,
    content: "fresh",
  });

  await assert.rejects(
    () =>
      repository.transitionMessage("owner-a", assistant.id, "complete", {
        expectedAttemptNumber: first.attempt.attemptNumber,
        content: "stale",
      }),
    (error: unknown) => error instanceof HeavyChatAttemptConflictError,
  );
  assert.equal((await repository.findMessageById("owner-a", assistant.id))?.content, "fresh");
});

test("stale pending and streaming attempts are reclaimed into a new fenced attempt", async () => {
  let currentTime = new Date("2026-07-19T00:00:00.000Z");
  const { repository } = buildRepository({ now: () => currentTime });
  const reserveMessageAttempt = repository.reserveMessageAttempt as unknown as (
    ownerUserId: string,
    messageId: string,
    idempotencyKey: string,
    options?: { staleBefore?: Date },
  ) => Promise<{
    attempt: HeavyChatMessageAttemptRecord;
    message: HeavyChatMessageRecord;
    created: boolean;
  }>;
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-stale-recovery",
    slotId: slot.id,
    title: "Stale recovery",
  });

  for (const initialStatus of ["pending", "streaming"] as const) {
    const assistant = await repository.appendMessage("owner-a", {
      id: `message-stale-${initialStatus}`,
      threadId: thread.id,
      role: "assistant",
      status: "pending",
      idempotencyKey: `assistant-stale-${initialStatus}`,
    });
    const first = await reserveMessageAttempt("owner-a", assistant.id, `stale-${initialStatus}`);
    if (initialStatus === "streaming") {
      await repository.transitionMessage("owner-a", assistant.id, "streaming", {
        expectedAttemptNumber: first.attempt.attemptNumber,
        content: "partial",
      });
    }

    currentTime = new Date(currentTime.getTime() + 10 * 60 * 1000);
    const recovered = await reserveMessageAttempt(
      "owner-a",
      assistant.id,
      `stale-${initialStatus}`,
      { staleBefore: new Date(currentTime.getTime() - 5 * 60 * 1000) },
    );
    assert.equal(recovered.created, true);
    assert.equal(recovered.attempt.attemptNumber, 2);
    assert.equal(recovered.message.status, "pending");

    const replay = await reserveMessageAttempt(
      "owner-a",
      assistant.id,
      `stale-${initialStatus}`,
      { staleBefore: new Date(currentTime.getTime() - 5 * 60 * 1000) },
    );
    assert.equal(replay.created, false);
    assert.equal(replay.attempt.id, recovered.attempt.id);

    await assert.rejects(
      () =>
        repository.transitionMessage("owner-a", assistant.id, "complete", {
          expectedAttemptNumber: first.attempt.attemptNumber,
          content: "stale result",
        }),
      (error: unknown) => error instanceof HeavyChatAttemptConflictError,
    );
    const fresh = await repository.transitionMessage("owner-a", assistant.id, "complete", {
      expectedAttemptNumber: recovered.attempt.attemptNumber,
      content: "fresh result",
    });
    assert.equal(fresh.content, "fresh result");
  }
});

test("attempt-aware transitions fail closed when a store lacks atomic CAS", async () => {
  const { repository, store } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-cas-required",
    slotId: slot.id,
    title: "CAS required",
  });
  const assistant = await repository.appendMessage("owner-a", {
    id: "message-cas-required",
    threadId: thread.id,
    role: "assistant",
    status: "pending",
  });
  const first = await repository.reserveMessageAttempt("owner-a", assistant.id, "cas-required-1");
  (store as unknown as { updateMessageIfStatusAndAttempt?: unknown }).updateMessageIfStatusAndAttempt =
    undefined;

  await assert.rejects(
    () =>
      repository.transitionMessage("owner-a", assistant.id, "complete", {
        expectedAttemptNumber: first.attempt.attemptNumber,
        content: "must not write",
      }),
    /attempt-aware.*CAS|compare-and-set/i,
  );
  assert.equal((await repository.findMessageById("owner-a", assistant.id))?.status, "pending");
});

test("message actions reserve and complete exactly once with a stable server identity", async () => {
  const { repository } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-actions",
    slotId: slot.id,
    title: "Action lifecycle",
  });
  const assistant = await repository.appendMessage("owner-a", {
    id: "message-actions",
    threadId: thread.id,
    role: "assistant",
    status: "complete",
    content: "Create a task draft",
  });

  const first = await repository.reserveMessageAction("owner-a", assistant.id, "task");
  const replay = await repository.reserveMessageAction("owner-a", assistant.id, "task");

  assert.equal(first.claimed, true);
  assert.equal(first.action.id, `heavy-chat-action:${assistant.id}:task`);
  assert.equal(first.action.status, "pending");
  assert.equal(first.action.attemptNumber, 1);
  assert.equal(replay.claimed, false);
  assert.equal(replay.action.id, first.action.id);

  const completed = await repository.completeMessageAction(
    "owner-a",
    assistant.id,
    first.action.id,
    first.action.attemptNumber,
    "task-draft-1",
  );
  assert.equal(completed.action.status, "complete");
  assert.equal(completed.action.targetId, "task-draft-1");

  const completeReplay = await repository.completeMessageAction(
    "owner-a",
    assistant.id,
    first.action.id,
    first.action.attemptNumber,
    "task-draft-1",
  );
  assert.equal(completeReplay.action.targetId, "task-draft-1");
  const reservedComplete = await repository.reserveMessageAction("owner-a", assistant.id, "task");
  assert.equal(reservedComplete.claimed, false);
  assert.equal(reservedComplete.action.status, "complete");
});

test("failed message actions retry with fencing and preserve a known target", async () => {
  const { repository } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-action-retry",
    slotId: slot.id,
    title: "Action retry",
  });
  const assistant = await repository.appendMessage("owner-a", {
    id: "message-action-retry",
    threadId: thread.id,
    role: "assistant",
    status: "complete",
  });

  const first = await repository.reserveMessageAction("owner-a", assistant.id, "mailbox");
  const failed = await repository.failMessageAction(
    "owner-a",
    assistant.id,
    first.action.id,
    first.action.attemptNumber,
    { errorMessage: "target lookup failed", targetId: "mailbox-1" },
  );
  assert.equal(failed.action.status, "failed");
  assert.equal(failed.action.targetId, "mailbox-1");

  const retry = await repository.reserveMessageAction("owner-a", assistant.id, "mailbox");
  assert.equal(retry.claimed, true);
  assert.equal(retry.action.attemptNumber, 2);
  assert.equal(retry.action.targetId, "mailbox-1");
  assert.equal(retry.action.errorMessage, null);

  await assert.rejects(
    () =>
      repository.completeMessageAction(
        "owner-a",
        assistant.id,
        first.action.id,
        first.action.attemptNumber,
        "mailbox-1",
      ),
    (error: unknown) => error instanceof HeavyChatActionConflictError,
  );
  const completed = await repository.completeMessageAction(
    "owner-a",
    assistant.id,
    retry.action.id,
    retry.action.attemptNumber,
    "mailbox-1",
  );
  assert.equal(completed.action.status, "complete");
});

test("stale pending actions are reclaimed with a new attempt and fence old writers", async () => {
  const { repository } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-action-stale",
    slotId: slot.id,
    title: "Stale action recovery",
  });
  const assistant = await repository.appendMessage("owner-a", {
    id: "message-action-stale",
    threadId: thread.id,
    role: "assistant",
    status: "complete",
  });

  const first = await repository.reserveMessageAction("owner-a", assistant.id, "task");
  const recovered = await repository.reserveMessageAction(
    "owner-a",
    assistant.id,
    "task",
    { staleBefore: new Date("2026-07-20T00:00:00.000Z") },
  );

  assert.equal(recovered.claimed, true);
  assert.equal(recovered.action.attemptNumber, first.action.attemptNumber + 1);
  assert.equal(recovered.action.status, "pending");

  await assert.rejects(
    () => repository.completeMessageAction(
      "owner-a",
      assistant.id,
      first.action.id,
      first.action.attemptNumber,
      "task-stale",
    ),
    (error: unknown) => error instanceof HeavyChatActionConflictError,
  );
  await assert.rejects(
    () => repository.failMessageAction(
      "owner-a",
      assistant.id,
      first.action.id,
      first.action.attemptNumber,
      { errorMessage: "stale failure" },
    ),
    (error: unknown) => error instanceof HeavyChatActionConflictError,
  );

  const completed = await repository.completeMessageAction(
    "owner-a",
    assistant.id,
    recovered.action.id,
    recovered.action.attemptNumber,
    "task-fresh",
  );
  assert.equal(completed.action.targetId, "task-fresh");
});

test("concurrent task and mailbox actions preserve both JSONB entries", async () => {
  const { repository } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-action-parallel",
    slotId: slot.id,
    title: "Parallel actions",
  });
  const assistant = await repository.appendMessage("owner-a", {
    id: "message-action-parallel",
    threadId: thread.id,
    role: "assistant",
    status: "complete",
  });

  const [task, mailbox] = await Promise.all([
    repository.reserveMessageAction("owner-a", assistant.id, "task"),
    repository.reserveMessageAction("owner-a", assistant.id, "mailbox"),
  ]);
  await Promise.all([
    repository.completeMessageAction(
      "owner-a",
      assistant.id,
      task.action.id,
      task.action.attemptNumber,
      "task-1",
    ),
    repository.completeMessageAction(
      "owner-a",
      assistant.id,
      mailbox.action.id,
      mailbox.action.attemptNumber,
      "mailbox-1",
    ),
  ]);

  const persisted = await repository.findMessageById("owner-a", assistant.id);
  assert.deepEqual(
    persisted?.actions.map((action) => [action.type, action.status, action.targetId]).sort(),
    [
      ["mailbox", "complete", "mailbox-1"],
      ["task", "complete", "task-1"],
    ],
  );
});

test("message action reservations reject foreign owners and non-complete assistants", async () => {
  const { repository } = buildRepository();
  const slot = await repository.createOrGetDefaultSlot("owner-a");
  const thread = await repository.createThread("owner-a", {
    id: "thread-action-denial",
    slotId: slot.id,
    title: "Action denial",
  });
  const userMessage = await repository.appendMessage("owner-a", {
    id: "message-action-user",
    threadId: thread.id,
    role: "user",
    status: "complete",
  });
  const failedAssistant = await repository.appendMessage("owner-a", {
    id: "message-action-failed",
    threadId: thread.id,
    role: "assistant",
    status: "failed",
  });

  await assert.rejects(
    () => repository.reserveMessageAction("owner-b", userMessage.id, "task"),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );
  await assert.rejects(
    () => repository.reserveMessageAction("owner-a", userMessage.id, "task"),
    (error: unknown) => error instanceof HeavyChatInvalidTransitionError,
  );
  await assert.rejects(
    () => repository.reserveMessageAction("owner-a", failedAssistant.id, "mailbox"),
    (error: unknown) => error instanceof HeavyChatInvalidTransitionError,
  );
});

test("schema and migration carry owner-scoped uniqueness, foreign keys, and idempotency", async () => {
  const messageConfig = getTableConfig(heavyChatMessages);
  const bindingConfig = getTableConfig(heavyChatSlotProjects);
  const threadConfig = getTableConfig(heavyChatThreads);
  const messageIndexes = messageConfig.indexes.map((index) => index.config.name);

  assert.ok(messageIndexes.includes("heavy_chat_messages_owner_idempotency_idx"));
  assert.ok(messageIndexes.includes("heavy_chat_messages_owner_thread_sequence_idx"));
  assert.ok(messageConfig.foreignKeys.length >= 1);
  assert.ok(bindingConfig.foreignKeys.length >= 2);
  assert.ok(threadConfig.foreignKeys.length >= 3);

  const migrationPath = path.resolve(
    __dirname,
    "../../../migrations/0138_heavy_chat.sql",
  );
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /heavy_chat_messages_owner_idempotency_idx/);
  assert.match(migration, /heavy_chat_messages_owner_thread_fk/);
  assert.match(migration, /references heavy_chat_slots\(owner_user_id, id\)/);
  assert.match(migration, /heavy_chat_threads_owner_slot_project_binding_fk/);
  assert.match(
    migration,
    /references heavy_chat_slot_projects\(owner_user_id, slot_id, project_id\)/,
  );
  assert.match(migration, /create table if not exists heavy_chat_slot_agents/);
  assert.match(migration, /references agents\(owner_user_id, id\)/);
  assert.match(migration, /heavy_chat_slot_agents_owner_slot_idx/);
  assert.match(migration, /heavy_chat_slot_agents_owner_agent_idx/);
  assert.match(migration, /create table if not exists heavy_chat_message_attempts/);
  assert.match(migration, /heavy_chat_message_attempts_owner_idempotency_idx/);
  assert.match(migration, /check \(attempt_number > 0\)/);
  assert.match(migration, /check \(sequence > 0\)/);
});

test("core package exposes explicit heavy chat unit and required integration gates", async () => {
  const packagePath = path.resolve(__dirname, "../../../package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.match(packageJson.scripts?.test ?? "", /heavy-chat\/repository\.test\.ts/);
  assert.match(packageJson.scripts?.["test:heavy-chat"] ?? "", /heavy-chat\/repository\.test\.ts/);
  assert.match(packageJson.scripts?.["test:integration"] ?? "", /test:integration:heavy-chat/);
  assert.match(
    packageJson.scripts?.["test:integration:heavy-chat"] ?? "",
    /heavy-chat\/repository\.integration\.test\.ts/,
  );
});
