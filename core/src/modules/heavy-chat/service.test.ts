import assert from "node:assert/strict";
import test from "node:test";

import type { HeavyChatRepository } from "./repository";
import { createHeavyChatService } from "./service";
import {
  type HeavyChatMessageAttemptRecord,
  type HeavyChatMessageRecord,
  type HeavyChatThreadRecord,
  HeavyChatOwnershipError,
  HeavyChatSlotLimitError,
} from "./types";

type FakeSlot = { id: string; ownerUserId: string; slotKey: string; title: string };
type FakeAgent = {
  id: string;
  ownerUserId: string;
  sourceType: "platform" | "external";
  hostingMode: "managed_heavy" | "managed_light" | "open_protocol";
  runtimeEndpoint: string | null;
  authMode: "none" | "apiKey" | "bearer";
  runtimeAuthToken: string | null;
  managedServiceId: string | null;
  managedProviderLabel: string | null;
  managedApiBaseUrl: string | null;
  managedModel: string | null;
  managedApiKey: string | null;
  managedSystemPrompt: string | null;
  managedPromptTemplate: string | null;
  managedTaskCategory: string | null;
  managedCapabilitySummary: string | null;
};

function buildFakeRepository() {
  const slots = new Map<string, FakeSlot>();
  const bindings = new Map<string, { slotId: string; agentId: string }>();
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let nextId = 0;
  const repository = {
    async createOrGetDefaultSlot(ownerUserId: string) {
      calls.push({ method: "createOrGetDefaultSlot", args: [ownerUserId] });
      const key = `${ownerUserId}:mimi`;
      const existing = [...slots.values()].find((slot) => `${slot.ownerUserId}:${slot.slotKey}` === key);
      if (existing) return existing;
      const slot = { id: `slot-${++nextId}`, ownerUserId, slotKey: "mimi", title: "觅觅" };
      slots.set(slot.id, slot);
      return slot;
    },
    async createCustomSlot(ownerUserId: string, input: { title: string; maxSlots?: number }) {
      calls.push({ method: "createCustomSlot", args: [ownerUserId, input] });
      const current = [...slots.values()].filter((slot) => slot.ownerUserId === ownerUserId);
      if (current.length >= (input.maxSlots ?? 2)) {
        throw new HeavyChatSlotLimitError("slot limit reached");
      }
      const slot = {
        id: `slot-${++nextId}`,
        ownerUserId,
        slotKey: `custom-${nextId}`,
        title: input.title,
      };
      slots.set(slot.id, slot);
      return slot;
    },
    async createThread(ownerUserId: string, input: { slotId: string; title: string }) {
      calls.push({ method: "createThread", args: [ownerUserId, input] });
      const slot = slots.get(input.slotId);
      if (!slot || slot.ownerUserId !== ownerUserId) {
        throw new HeavyChatOwnershipError("slot does not belong to owner");
      }
      return { id: `thread-${++nextId}`, ownerUserId, ...input, projectId: null };
    },
    async appendMessage(ownerUserId: string, input: { threadId: string; content?: string }) {
      calls.push({ method: "appendMessage", args: [ownerUserId, input] });
      return { id: `message-${++nextId}`, ownerUserId, ...input, status: "complete" };
    },
    async reserveMessageAttempt(ownerUserId: string, messageId: string, idempotencyKey: string) {
      calls.push({ method: "reserveMessageAttempt", args: [ownerUserId, messageId, idempotencyKey] });
      return {
        created: true,
        attempt: { id: `attempt-${++nextId}`, ownerUserId, messageId, idempotencyKey, attemptNumber: 1 },
        message: { id: messageId, ownerUserId, status: "pending" },
      };
    },
    async bindAgentToSlot(ownerUserId: string, slotId: string, agentId: string) {
      calls.push({ method: "bindAgentToSlot", args: [ownerUserId, slotId, agentId] });
      const slot = slots.get(slotId);
      if (!slot || slot.ownerUserId !== ownerUserId) {
        throw new HeavyChatOwnershipError("slot does not belong to owner");
      }
      const binding = { slotId, agentId };
      bindings.set(`${ownerUserId}:${slotId}`, binding);
      return { id: `binding-${++nextId}`, ownerUserId, ...binding };
    },
    async findAgentBindingForSlot(ownerUserId: string, slotId: string) {
      const binding = bindings.get(`${ownerUserId}:${slotId}`);
      return binding ? { id: "binding-existing", ownerUserId, ...binding } : null;
    },
    async listAgentBindingsForSlots(ownerUserId: string, slotIds: string[]) {
      calls.push({ method: "listAgentBindingsForSlots", args: [ownerUserId, slotIds] });
      const slotIdSet = new Set(slotIds);
      return [...bindings.entries()]
        .filter(([key, binding]) => key.startsWith(`${ownerUserId}:`) && slotIdSet.has(binding.slotId))
        .map(([, binding]) => ({ id: `binding-${binding.slotId}`, ownerUserId, ...binding }));
    },
    async listSlots(ownerUserId: string) {
      return [...slots.values()].filter((slot) => slot.ownerUserId === ownerUserId);
    },
    async listProjects() {
      return [];
    },
    async listProjectsForSlot() {
      return [];
    },
    async listProjectBindingsForSlots(ownerUserId: string, slotIds: string[]) {
      calls.push({ method: "listProjectBindingsForSlots", args: [ownerUserId, slotIds] });
      return [];
    },
    async listThreads() {
      return [];
    },
    async findThreadById(ownerUserId: string, threadId: string) {
      calls.push({ method: "findThreadById", args: [ownerUserId, threadId] });
      if (ownerUserId !== "owner-a" || threadId !== "thread-owned") return null;
      const timestamp = new Date("2026-07-20T00:00:00.000Z");
      return {
        id: threadId,
        ownerUserId,
        slotId: "slot-owned",
        projectId: null,
        title: "Owned thread",
        favorite: false,
        sortOrder: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    },
    async listMessages() {
      return [];
    },
    async listMessagesByThreadIds(ownerUserId: string, threadIds: string[]) {
      calls.push({ method: "listMessagesByThreadIds", args: [ownerUserId, threadIds] });
      return [];
    },
    async listRecentMessagePages(ownerUserId: string, threadIds: string[], pageSize: number) {
      calls.push({ method: "listRecentMessagePages", args: [ownerUserId, threadIds, pageSize] });
      return threadIds.map((threadId) => ({
        threadId,
        messages: [],
        hasMore: false,
        nextBeforeSequence: null,
      }));
    },
    async listMessagePage(
      ownerUserId: string,
      threadId: string,
      beforeSequence: number | null,
      pageSize: number,
    ) {
      calls.push({ method: "listMessagePage", args: [ownerUserId, threadId, beforeSequence, pageSize] });
      return { threadId, messages: [], hasMore: false, nextBeforeSequence: null };
    },
    async listGatewayHistoryMessages() {
      return [];
    },
  };
  return { repository: repository as unknown as HeavyChatRepository, calls, slots };
}

function validAgent(overrides: Partial<FakeAgent> = {}): FakeAgent {
  return {
    id: "agent-heavy",
    ownerUserId: "owner-a",
    sourceType: "platform",
    hostingMode: "managed_heavy",
    runtimeEndpoint: null,
    authMode: "none",
    runtimeAuthToken: null,
    managedServiceId: null,
    managedProviderLabel: null,
    managedApiBaseUrl: null,
    managedModel: null,
    managedApiKey: null,
    managedSystemPrompt: null,
    managedPromptTemplate: null,
    managedTaskCategory: null,
    managedCapabilitySummary: null,
    ...overrides,
  };
}

test("heavy chat service builds an owner-scoped snapshot after ensuring the default slot", async () => {
  const { repository, calls } = buildFakeRepository();
  const service = createHeavyChatService({
    repository,
    resolveManagedHeavyAgent: async () => validAgent(),
  });

  const snapshot = await service.getSnapshot("owner-a");

  assert.deepEqual(snapshot.projects, []);
  assert.deepEqual(snapshot.slotProjects, []);
  assert.deepEqual(snapshot.bindings, []);
  assert.deepEqual(snapshot.threads, []);
  assert.deepEqual(snapshot.messages, []);
  assert.deepEqual(snapshot.messagePages, []);
  assert.equal(snapshot.slots.length, 1);
  assert.equal(snapshot.slots[0]?.ownerUserId, "owner-a");
  assert.ok(calls.some((call) => call.method === "createOrGetDefaultSlot"));
  assert.deepEqual(calls.find((call) => call.method === "listRecentMessagePages")?.args, ["owner-a", [], 50]);
  assert.equal(calls.filter((call) => call.method === "listAgentBindingsForSlots").length, 1);
  assert.equal(calls.filter((call) => call.method === "listProjectBindingsForSlots").length, 1);
});

test("heavy chat snapshot batches thread messages once and preserves snapshot thread order", async () => {
  const { repository, calls } = buildFakeRepository();
  const createdAt = new Date("2026-07-20T00:00:00.000Z");
  const threads: HeavyChatThreadRecord[] = [
    {
      id: "thread-b",
      ownerUserId: "owner-a",
      slotId: "slot-b",
      projectId: null,
      title: "Thread B",
      favorite: true,
      sortOrder: 0,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "thread-a",
      ownerUserId: "owner-a",
      slotId: "slot-a",
      projectId: null,
      title: "Thread A",
      favorite: false,
      sortOrder: 0,
      createdAt,
      updatedAt: createdAt,
    },
  ];
  const toMessage = (id: string, threadId: string): HeavyChatMessageRecord => ({
    id,
    ownerUserId: "owner-a",
    threadId,
    role: "user",
    status: "complete",
    sequence: 1,
    attemptNumber: 0,
    content: id,
    references: [],
    actions: [],
    idempotencyKey: null,
    errorCode: null,
    errorMessage: null,
    createdAt,
    updatedAt: createdAt,
  });
  repository.listThreads = async () => threads;
  repository.listRecentMessagePages = async (ownerUserId, threadIds, pageSize) => {
    calls.push({ method: "listRecentMessagePages", args: [ownerUserId, threadIds, pageSize] });
    return [
      {
        threadId: "thread-b",
        messages: [toMessage("message-b", "thread-b")],
        hasMore: true,
        nextBeforeSequence: 1,
      },
      {
        threadId: "thread-a",
        messages: [toMessage("message-a", "thread-a")],
        hasMore: false,
        nextBeforeSequence: null,
      },
    ];
  };
  const service = createHeavyChatService({
    repository,
    resolveManagedHeavyAgent: async () => validAgent(),
  });

  const snapshot = await service.getSnapshot("owner-a");

  assert.deepEqual(snapshot.threads.map((thread) => thread.id), ["thread-b", "thread-a"]);
  assert.deepEqual(snapshot.messages.map((message) => message.id), ["message-b", "message-a"]);
  assert.deepEqual(snapshot.messagePages, [
    { threadId: "thread-b", hasMore: true, nextBeforeSequence: 1 },
    { threadId: "thread-a", hasMore: false, nextBeforeSequence: null },
  ]);
  assert.deepEqual(
    calls.filter((call) => call.method === "listRecentMessagePages").map((call) => call.args),
    [["owner-a", ["thread-b", "thread-a"], 50]],
  );
});

test("heavy chat service validates thread ownership and message page size", async () => {
  const { repository, calls } = buildFakeRepository();
  const service = createHeavyChatService({
    repository,
    resolveManagedHeavyAgent: async () => validAgent(),
  });

  const page = await service.getMessagePage("owner-a", "thread-owned", {
    beforeSequence: 41,
    pageSize: 100,
  });
  assert.equal(page.threadId, "thread-owned");
  assert.deepEqual(calls.find((call) => call.method === "listMessagePage")?.args, [
    "owner-a",
    "thread-owned",
    41,
    100,
  ]);

  await service.getMessagePage("owner-a", "thread-owned");
  assert.deepEqual(calls.filter((call) => call.method === "listMessagePage").at(-1)?.args, [
    "owner-a",
    "thread-owned",
    null,
    50,
  ]);

  const pageCallsBeforeInvalidInput = calls.filter((call) => call.method === "listMessagePage").length;
  for (const pageSize of [0, 101, 1.5, Number.NaN]) {
    await assert.rejects(
      () => service.getMessagePage("owner-a", "thread-owned", { pageSize }),
      /page size.*between 1 and 100/i,
    );
  }
  assert.equal(
    calls.filter((call) => call.method === "listMessagePage").length,
    pageCallsBeforeInvalidInput,
  );

  const pageCallsBeforeDenial = calls.filter((call) => call.method === "listMessagePage").length;
  await assert.rejects(
    () => service.getMessagePage("owner-b", "thread-owned"),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );
  assert.equal(calls.filter((call) => call.method === "listMessagePage").length, pageCallsBeforeDenial);
});

test("P2-05: heavy chat service delegates owner-scoped message actions to the bridge", async () => {
  const { repository } = buildFakeRepository();
  let capturedOwner = "";
  let capturedInput: { messageId: string; type: "task" | "mailbox" } | null = null;
  const service = createHeavyChatService({
    repository,
    resolveManagedHeavyAgent: async () => validAgent(),
    actionBridge: {
      async runAction(ownerUserId, input) {
        capturedOwner = ownerUserId;
        capturedInput = input;
        return {
          action: {
            id: "action-1",
            type: input.type,
            status: "complete" as const,
            attemptNumber: 1,
            targetId: "target-1",
            errorMessage: null,
            updatedAt: new Date("2026-07-20T08:00:00.000Z").toISOString(),
          },
          target: { id: "target-1", type: input.type, href: "/target/target-1" },
          executed: true,
          created: true,
        };
      },
    },
  });

  const result = await service.runMessageAction("owner-a", {
    messageId: "message-1",
    type: "task",
  });

  assert.equal(capturedOwner, "owner-a");
  assert.deepEqual(capturedInput, { messageId: "message-1", type: "task" });
  assert.equal(result.action.targetId, "target-1");
  assert.equal(result.created, true);
});

test("heavy chat service applies server-side entitlement and preserves repository idempotency", async () => {
  const { repository, calls } = buildFakeRepository();
  const service = createHeavyChatService({
    repository,
    resolveMaxSlots: async () => 3,
    resolveManagedHeavyAgent: async () => validAgent(),
  });

  const defaultSlot = await service.ensureDefaultSlot("owner-a");
  assert.equal(defaultSlot.title, "觅觅");
  const customSlot = await service.createCustomSlot("owner-a", { title: "Research" });
  assert.equal(customSlot.title, "Research");
  const customCall = calls.find((call) => call.method === "createCustomSlot");
  assert.deepEqual(customCall?.args[1], { title: "Research", maxSlots: 3 });

  const thread = await service.createThread("owner-a", { slotId: customSlot.id, title: "Thread" });
  const message = await service.appendMessage("owner-a", {
    threadId: thread.id,
    role: "user",
    content: "hello",
    idempotencyKey: "message-1",
  });
  const retry = await service.reserveMessageAttempt("owner-a", message.id, "retry-1");
  assert.equal(retry.created, true);
  assert.equal(calls.filter((call) => call.method === "reserveMessageAttempt").length, 1);
});

test("heavy chat service binds only an owned platform managed-heavy agent", async () => {
  const { repository } = buildFakeRepository();
  let agent: FakeAgent | null = validAgent();
  const service = createHeavyChatService({
    repository,
    resolveManagedHeavyAgent: async () => agent,
  });
  const slot = await service.ensureDefaultSlot("owner-a");

  const binding = await service.bindManagedAgent("owner-a", slot.id, "agent-heavy");
  assert.equal(binding.agentId, "agent-heavy");

  agent = validAgent({ sourceType: "external", runtimeEndpoint: "https://runtime.invalid" });
  await assert.rejects(
    () => service.bindManagedAgent("owner-a", slot.id, "agent-heavy"),
    /platform-owned managed_heavy/i,
  );

  agent = validAgent({ managedServiceId: "service-light" });
  await assert.rejects(
    () => service.bindManagedAgent("owner-a", slot.id, "agent-heavy"),
    /external runtime or managed-light/i,
  );
});

test("heavy chat service preserves owner denial at the service boundary", async () => {
  const { repository } = buildFakeRepository();
  const service = createHeavyChatService({ repository, resolveManagedHeavyAgent: async () => validAgent() });
  const slot = await service.ensureDefaultSlot("owner-a");
  await assert.rejects(
    () => service.createThread("owner-b", { slotId: slot.id, title: "cross-user" }),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );
  await assert.rejects(
    () => service.bindManagedAgent("owner-b", slot.id, "agent-heavy"),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );
});

test("heavy chat service rejects mismatched agent resolution and every managed-heavy runtime field", async () => {
  const { repository } = buildFakeRepository();
  let agent: FakeAgent | null = validAgent();
  const service = createHeavyChatService({
    repository,
    resolveManagedHeavyAgent: async () => agent,
  });
  const slot = await service.ensureDefaultSlot("owner-a");

  agent = validAgent({ id: "different-agent" });
  await assert.rejects(
    () => service.bindManagedAgent("owner-a", slot.id, "agent-heavy"),
    (error: unknown) => error instanceof HeavyChatOwnershipError,
  );

  const forbiddenAgents: FakeAgent[] = [
    validAgent({ authMode: "bearer", runtimeAuthToken: "secret" }),
    validAgent({ managedProviderLabel: "provider" }),
    validAgent({ managedModel: "model" }),
    validAgent({ managedSystemPrompt: "system" }),
    validAgent({ managedPromptTemplate: "template" }),
    validAgent({ managedTaskCategory: "task" }),
    validAgent({ managedCapabilitySummary: "capability" }),
  ];

  for (const forbiddenAgent of forbiddenAgents) {
    agent = forbiddenAgent;
    await assert.rejects(
      () => service.bindManagedAgent("owner-a", slot.id, "agent-heavy"),
      /managed_heavy agent cannot set|external runtime or managed-light/i,
    );
  }
});

type P203GatewayRequest = {
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  requestId: string;
  correlationId: string;
  stream?: boolean;
  onChunk?: (delta: string) => Promise<void> | void;
};

type P203GatewayResponse = {
  content: string;
  requestId: string;
  statusCode: number;
  finishReason: string | null;
};

type P203GatewayClient = {
  complete(input: P203GatewayRequest): Promise<P203GatewayResponse>;
};

type P203SendResult = {
  userMessage: HeavyChatMessageRecord;
  assistantMessage: HeavyChatMessageRecord;
  attempt: HeavyChatMessageAttemptRecord;
  created: boolean;
};

type P203HeavyChatService = ReturnType<typeof createHeavyChatService> & {
  sendMessage(
    ownerUserId: string,
    input: {
      threadId: string;
      content: string;
      idempotencyKey: string;
      correlationId: string;
    },
  ): Promise<P203SendResult>;
  retryMessage(
    ownerUserId: string,
    input: {
      messageId: string;
      idempotencyKey: string;
      correlationId: string;
    },
  ): Promise<Omit<P203SendResult, "userMessage">>;
};

type P203GatewayDispatch = (input: P203GatewayRequest) => Promise<P203GatewayResponse>;

function createP203Deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitForP203Condition(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.fail("Timed out waiting for the P2-03 test condition");
}

function buildP203ExecutionHarness() {
  const ownerUserId = "owner-p203";
  const slotId = "slot-p203";
  const threadId = "thread-p203";
  const agentId = "agent-p203";
  const events: string[] = [];
  const messages = new Map<string, HeavyChatMessageRecord>();
  const attempts = new Map<string, HeavyChatMessageAttemptRecord>();
  const gatewayRequests: P203GatewayRequest[] = [];
  let nextMessageId = 0;
  let nextAttemptId = 0;
  let historyFailure: Error | null = null;
  let gatewayDispatch: P203GatewayDispatch = async (input) => ({
    content: "default response",
    requestId: input.requestId,
    statusCode: 200,
    finishReason: "stop",
  });

  function findMessageByIdempotencyKey(candidateOwnerUserId: string, idempotencyKey: string) {
    return (
      [...messages.values()].find(
        (message) =>
          message.ownerUserId === candidateOwnerUserId && message.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  }

  function currentAttemptNumber(messageId: string) {
    return [...attempts.values()]
      .filter((attempt) => attempt.ownerUserId === ownerUserId && attempt.messageId === messageId)
      .reduce((maximum, attempt) => Math.max(maximum, attempt.attemptNumber), 0);
  }

  const repository = {
    async findThreadById(candidateOwnerUserId: string, candidateThreadId: string) {
      if (candidateOwnerUserId !== ownerUserId || candidateThreadId !== threadId) return null;
      return {
        id: threadId,
        ownerUserId,
        slotId,
        projectId: null,
        title: "P2-03 thread",
        favorite: false,
        sortOrder: 0,
        createdAt: new Date("2026-07-19T00:00:00.000Z"),
        updatedAt: new Date("2026-07-19T00:00:00.000Z"),
      };
    },
    async findAgentBindingForSlot(candidateOwnerUserId: string, candidateSlotId: string) {
      if (candidateOwnerUserId !== ownerUserId || candidateSlotId !== slotId) return null;
      return {
        id: "binding-p203",
        ownerUserId,
        slotId,
        agentId,
        createdAt: new Date("2026-07-19T00:00:00.000Z"),
        updatedAt: new Date("2026-07-19T00:00:00.000Z"),
      };
    },
    async appendMessage(
      candidateOwnerUserId: string,
      input: {
        threadId: string;
        role: "user" | "assistant" | "system";
        status?: "pending" | "streaming" | "complete" | "failed";
        content?: string;
        idempotencyKey?: string | null;
      },
    ) {
      const idempotencyKey = input.idempotencyKey?.trim() || null;
      if (idempotencyKey) {
        const existing = findMessageByIdempotencyKey(candidateOwnerUserId, idempotencyKey);
        if (existing) return existing;
      }
      const createdAt = new Date(`2026-07-19T00:00:${String(nextMessageId).padStart(2, "0")}.000Z`);
      const message: HeavyChatMessageRecord = {
        id: `message-p203-${++nextMessageId}`,
        ownerUserId: candidateOwnerUserId,
        threadId: input.threadId,
        role: input.role,
        status: input.status ?? (input.role === "assistant" ? "pending" : "complete"),
        sequence: messages.size + 1,
        attemptNumber: 0,
        content: input.content ?? "",
        references: [],
        actions: [],
        idempotencyKey,
        errorCode: null,
        errorMessage: null,
        createdAt,
        updatedAt: createdAt,
      };
      messages.set(message.id, message);
      events.push(`append:${message.role}:${message.status}`);
      return message;
    },
    async reserveMessageAttempt(
      candidateOwnerUserId: string,
      messageId: string,
      idempotencyKey: string,
    ) {
      const existingAttempt = [...attempts.values()].find(
        (attempt) =>
          attempt.ownerUserId === candidateOwnerUserId && attempt.idempotencyKey === idempotencyKey,
      );
      if (existingAttempt) {
        const existingMessage = messages.get(existingAttempt.messageId);
        assert.ok(existingMessage);
        return { attempt: existingAttempt, message: existingMessage, created: false as const };
      }
      const message = messages.get(messageId);
      if (!message || message.ownerUserId !== candidateOwnerUserId) {
        throw new HeavyChatOwnershipError("message does not belong to owner");
      }
      const attemptNumber = currentAttemptNumber(messageId) + 1;
      const attempt: HeavyChatMessageAttemptRecord = {
        id: `attempt-p203-${++nextAttemptId}`,
        ownerUserId: candidateOwnerUserId,
        messageId,
        idempotencyKey,
        attemptNumber,
        createdAt: new Date(),
      };
      attempts.set(attempt.id, attempt);
      const pendingMessage = {
        ...message,
        status: "pending" as const,
        attemptNumber,
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      };
      messages.set(messageId, pendingMessage);
      events.push(`attempt:${attemptNumber}`);
      return { attempt, message: pendingMessage, created: true as const };
    },
    async transitionMessage(
      candidateOwnerUserId: string,
      messageId: string,
      status: "pending" | "streaming" | "complete" | "failed",
      input: {
        content?: string;
        errorCode?: string | null;
        errorMessage?: string | null;
      } = {},
    ) {
      const message = messages.get(messageId);
      if (!message || message.ownerUserId !== candidateOwnerUserId) {
        throw new HeavyChatOwnershipError("message does not belong to owner");
      }
      const updated = {
        ...message,
        status,
        content: input.content ?? message.content,
        errorCode: input.errorCode !== undefined ? input.errorCode : message.errorCode,
        errorMessage: input.errorMessage !== undefined ? input.errorMessage : message.errorMessage,
        updatedAt: new Date(),
      };
      messages.set(messageId, updated);
      events.push(`transition:${status}:${updated.content}`);
      return updated;
    },
    async findMessageById(candidateOwnerUserId: string, messageId: string) {
      const message = messages.get(messageId) ?? null;
      return message?.ownerUserId === candidateOwnerUserId ? message : null;
    },
    async findMessageByIdempotencyKey(candidateOwnerUserId: string, idempotencyKey: string) {
      return findMessageByIdempotencyKey(candidateOwnerUserId, idempotencyKey);
    },
    async listMessages(candidateOwnerUserId: string, candidateThreadId: string) {
      return [...messages.values()]
        .filter(
          (message) =>
            message.ownerUserId === candidateOwnerUserId && message.threadId === candidateThreadId,
        )
        .sort((left, right) => left.sequence - right.sequence);
    },
    async listGatewayHistoryMessages(
      candidateOwnerUserId: string,
      candidateThreadId: string,
      beforeSequence: number,
    ) {
      if (historyFailure) {
        const error = historyFailure;
        historyFailure = null;
        throw error;
      }
      return [...messages.values()]
        .filter(
          (message) =>
            message.ownerUserId === candidateOwnerUserId &&
            message.threadId === candidateThreadId &&
            message.sequence < beforeSequence &&
            message.status === "complete" &&
            message.content.trim(),
        )
        .sort((left, right) => left.sequence - right.sequence)
        .map(({ role, content }) => ({ role, content }));
    },
  };

  const gatewayClient: P203GatewayClient = {
    async complete(input) {
      gatewayRequests.push(input);
      events.push("gateway:start");
      return gatewayDispatch(input);
    },
  };
  const typedRepository = repository as unknown as HeavyChatRepository;

  const service = createHeavyChatService({
    repository: typedRepository,
    resolveManagedHeavyAgent: async (candidateOwnerUserId, candidateAgentId) =>
      candidateOwnerUserId === ownerUserId && candidateAgentId === agentId
        ? validAgent({ id: agentId, ownerUserId })
        : null,
    gatewayClient,
    gatewayModel: "heavy-default-model",
  } as Parameters<typeof createHeavyChatService>[0] & {
    gatewayClient: P203GatewayClient;
    gatewayModel: string;
  }) as P203HeavyChatService;

  return {
    ownerUserId,
    threadId,
    agentId,
    service,
    repository: typedRepository,
    events,
    messages,
    attempts,
    gatewayRequests,
    setGatewayDispatch(dispatch: P203GatewayDispatch) {
      gatewayDispatch = dispatch;
    },
    setHistoryFailure(error: Error | null) {
      historyFailure = error;
    },
  };
}

test("P2-03 RED: send persists user, pending assistant, and attempt before streaming to complete", async () => {
  const harness = buildP203ExecutionHarness();
  harness.setGatewayDispatch(async (input) => {
    assert.deepEqual(harness.events.slice(0, 4), [
      "append:user:complete",
      "append:assistant:pending",
      "attempt:1",
      "gateway:start",
    ]);
    await input.onChunk?.("Hello");
    await input.onChunk?.(" world");
    return {
      content: "Hello world",
      requestId: input.requestId,
      statusCode: 200,
      finishReason: "stop",
    };
  });

  const result = await harness.service.sendMessage(harness.ownerUserId, {
    threadId: harness.threadId,
    content: "Start the task",
    idempotencyKey: "send-p203-success",
    correlationId: "corr-p203-success",
  });

  assert.equal(result.userMessage.status, "complete");
  assert.equal(result.assistantMessage.status, "complete");
  assert.equal(result.assistantMessage.content, "Hello world");
  assert.equal(result.attempt.attemptNumber, 1);
  assert.equal(harness.gatewayRequests[0]?.model, "heavy-default-model");
  assert.equal(harness.gatewayRequests[0]?.correlationId, "corr-p203-success");
  assert.equal(harness.gatewayRequests[0]?.requestId, result.attempt.id);
  assert.deepEqual(
    harness.events.filter((event) => event.startsWith("transition:streaming:")),
    ["transition:streaming:Hello", "transition:streaming:Hello world"],
  );
  assert.equal(harness.events.at(-1), "transition:complete:Hello world");
});

test("P2-03 RED: gateway failure persists a retryable failed assistant message", async () => {
  const harness = buildP203ExecutionHarness();
  harness.setGatewayDispatch(async () => {
    throw Object.assign(new Error("provider denied the request"), {
      code: "provider_rejected",
      statusCode: 429,
      requestId: "attempt-provider-rejected",
    });
  });

  await assert.rejects(
    () =>
      harness.service.sendMessage(harness.ownerUserId, {
        threadId: harness.threadId,
        content: "This should fail",
        idempotencyKey: "send-p203-failure",
        correlationId: "corr-p203-failure",
      }),
    /provider denied/i,
  );

  const persistedMessages = [...harness.messages.values()];
  const userMessage = persistedMessages.find((message) => message.role === "user");
  const assistantMessage = persistedMessages.find((message) => message.role === "assistant");
  assert.equal(userMessage?.status, "complete");
  assert.equal(assistantMessage?.status, "failed");
  assert.equal(assistantMessage?.errorCode, "provider_rejected");
  assert.match(assistantMessage?.errorMessage ?? "", /provider denied/i);
  assert.equal(assistantMessage?.attemptNumber, 1);
});

test("P2-03 RED: repeated send idempotency key reuses messages and skips gateway redispatch", async () => {
  const harness = buildP203ExecutionHarness();
  harness.setGatewayDispatch(async (input) => ({
    content: "idempotent response",
    requestId: input.requestId,
    statusCode: 200,
    finishReason: "stop",
  }));
  const input = {
    threadId: harness.threadId,
    content: "Only send once",
    idempotencyKey: "send-p203-idempotent",
    correlationId: "corr-p203-idempotent",
  };

  const first = await harness.service.sendMessage(harness.ownerUserId, input);
  const replay = await harness.service.sendMessage(harness.ownerUserId, input);

  assert.equal(replay.created, false);
  assert.equal(replay.userMessage.id, first.userMessage.id);
  assert.equal(replay.assistantMessage.id, first.assistantMessage.id);
  assert.equal(replay.attempt.id, first.attempt.id);
  assert.equal(harness.messages.size, 2);
  assert.equal(harness.attempts.size, 1);
  assert.equal(harness.gatewayRequests.length, 1);
});

test("P2-03 RED: retry reuses the failed assistant and is idempotent by retry key", async () => {
  const harness = buildP203ExecutionHarness();
  let dispatchCount = 0;
  harness.setGatewayDispatch(async (input) => {
    dispatchCount += 1;
    if (dispatchCount === 1) {
      throw Object.assign(new Error("temporary provider timeout"), { code: "provider_timeout" });
    }
    await input.onChunk?.("Recovered");
    return {
      content: "Recovered",
      requestId: input.requestId,
      statusCode: 200,
      finishReason: "stop",
    };
  });

  await assert.rejects(() =>
    harness.service.sendMessage(harness.ownerUserId, {
      threadId: harness.threadId,
      content: "Retry this request",
      idempotencyKey: "send-p203-retry",
      correlationId: "corr-p203-retry-initial",
    }),
  );
  const failedAssistant = [...harness.messages.values()].find((message) => message.role === "assistant");
  assert.ok(failedAssistant);

  const firstRetry = await harness.service.retryMessage(harness.ownerUserId, {
    messageId: failedAssistant.id,
    idempotencyKey: "retry-p203-1",
    correlationId: "corr-p203-retry",
  });
  const replay = await harness.service.retryMessage(harness.ownerUserId, {
    messageId: failedAssistant.id,
    idempotencyKey: "retry-p203-1",
    correlationId: "corr-p203-retry",
  });

  assert.equal(firstRetry.assistantMessage.id, failedAssistant.id);
  assert.equal(firstRetry.assistantMessage.status, "complete");
  assert.equal(firstRetry.assistantMessage.content, "Recovered");
  assert.equal(firstRetry.attempt.attemptNumber, 2);
  assert.equal(replay.created, false);
  assert.equal(replay.attempt.id, firstRetry.attempt.id);
  assert.equal(harness.messages.size, 2);
  assert.equal(harness.attempts.size, 2);
  assert.equal(harness.gatewayRequests.length, 2);
});

test("P2-03 RED: a stale attempt cannot overwrite a newer retry result", async () => {
  const harness = buildP203ExecutionHarness();
  const staleGatewayResult = createP203Deferred<P203GatewayResponse>();
  let dispatchCount = 0;
  harness.setGatewayDispatch(async (input) => {
    dispatchCount += 1;
    if (dispatchCount === 1) return staleGatewayResult.promise;
    await input.onChunk?.("fresh result");
    return {
      content: "fresh result",
      requestId: input.requestId,
      statusCode: 200,
      finishReason: "stop",
    };
  });

  const staleSend = harness.service.sendMessage(harness.ownerUserId, {
    threadId: harness.threadId,
    content: "Race this request",
    idempotencyKey: "send-p203-stale",
    correlationId: "corr-p203-stale",
  });
  await waitForP203Condition(() => harness.gatewayRequests.length === 1);
  const assistantMessage = [...harness.messages.values()].find((message) => message.role === "assistant");
  assert.ok(assistantMessage);
  await harness.repository.transitionMessage(harness.ownerUserId, assistantMessage.id, "failed", {
    errorCode: "provider_timeout",
    errorMessage: "first attempt timed out",
  });

  const retry = await harness.service.retryMessage(harness.ownerUserId, {
    messageId: assistantMessage.id,
    idempotencyKey: "retry-p203-fresh",
    correlationId: "corr-p203-fresh",
  });
  assert.equal(retry.assistantMessage.attemptNumber, 2);
  assert.equal(retry.assistantMessage.content, "fresh result");

  staleGatewayResult.resolve({
    content: "stale result",
    requestId: harness.gatewayRequests[0]?.requestId ?? "stale-request",
    statusCode: 200,
    finishReason: "stop",
  });
  await staleSend.catch(() => undefined);

  const finalMessage = harness.messages.get(assistantMessage.id);
  assert.equal(finalMessage?.attemptNumber, 2);
  assert.equal(finalMessage?.status, "complete");
  assert.equal(finalMessage?.content, "fresh result");
});

test("P2-03 RED: send and retry reject blank idempotency keys before persistence", async () => {
  const harness = buildP203ExecutionHarness();

  await assert.rejects(
    () =>
      harness.service.sendMessage(harness.ownerUserId, {
        threadId: harness.threadId,
        content: "Should not persist",
        idempotencyKey: "   ",
        correlationId: "corr-p203-blank-send",
      }),
    /idempotency key/i,
  );
  await assert.rejects(
    () =>
      harness.service.retryMessage(harness.ownerUserId, {
        messageId: "missing-message",
        idempotencyKey: "\t",
        correlationId: "corr-p203-blank-retry",
      }),
    /idempotency key/i,
  );
  assert.equal(harness.messages.size, 0);
  assert.equal(harness.gatewayRequests.length, 0);
});

test("P2-03 RED: Gateway history contains only complete prior messages", async () => {
  const harness = buildP203ExecutionHarness();
  harness.setGatewayDispatch(async (input) => {
    return {
      content: "new answer",
      requestId: input.requestId,
      statusCode: 200,
      finishReason: "stop",
    };
  });

  await harness.repository.appendMessage(harness.ownerUserId, {
    threadId: harness.threadId,
    role: "user",
    status: "complete",
    content: "older question",
    idempotencyKey: "history-old-user",
  });
  await harness.repository.appendMessage(harness.ownerUserId, {
    threadId: harness.threadId,
    role: "assistant",
    status: "streaming",
    content: "partial answer that must be excluded",
    idempotencyKey: "history-partial-assistant",
  });
  await harness.repository.appendMessage(harness.ownerUserId, {
    threadId: harness.threadId,
    role: "assistant",
    status: "complete",
    content: "older answer",
    idempotencyKey: "history-complete-assistant",
  });

  await harness.service.sendMessage(harness.ownerUserId, {
    threadId: harness.threadId,
    content: "new question",
    idempotencyKey: "send-p203-history",
    correlationId: "corr-p203-history",
  });

  assert.deepEqual(harness.gatewayRequests.at(-1)?.messages, [
    { role: "user", content: "older question" },
    { role: "assistant", content: "older answer" },
    { role: "user", content: "new question" },
  ]);
});

test("P2-03 RED: a detached send method still executes through its private helper", async () => {
  const harness = buildP203ExecutionHarness();
  harness.setGatewayDispatch(async (input) => ({
    content: "detached response",
    requestId: input.requestId,
    statusCode: 200,
    finishReason: "stop",
  }));

  const { sendMessage } = harness.service;
  const result = await sendMessage(harness.ownerUserId, {
    threadId: harness.threadId,
    content: "Detached invocation",
    idempotencyKey: "send-p203-detached",
    correlationId: "corr-p203-detached",
  });

  assert.equal(result.assistantMessage.status, "complete");
  assert.equal(result.assistantMessage.content, "detached response");
});

test("P2-03 RED: configuration and history failures finalize the reserved assistant as failed", async () => {
  const configHarness = buildP203ExecutionHarness();
  const serviceWithoutGateway = createHeavyChatService({
    repository: configHarness.repository,
    resolveManagedHeavyAgent: async (ownerUserId, agentId) =>
      ownerUserId === configHarness.ownerUserId && agentId === configHarness.agentId
        ? validAgent({ id: configHarness.agentId, ownerUserId })
        : null,
  });

  await assert.rejects(
    () =>
      serviceWithoutGateway.sendMessage(configHarness.ownerUserId, {
        threadId: configHarness.threadId,
        content: "Missing gateway configuration",
        idempotencyKey: "send-p203-missing-gateway",
        correlationId: "corr-p203-missing-gateway",
      }),
    /Gateway client is not configured/i,
  );
  const configAssistant = [...configHarness.messages.values()].find((message) => message.role === "assistant");
  assert.equal(configAssistant?.status, "failed");
  assert.match(configAssistant?.errorMessage ?? "", /Gateway client is not configured/i);

  const historyHarness = buildP203ExecutionHarness();
  historyHarness.setHistoryFailure(new Error("history store unavailable"));
  await assert.rejects(
    () =>
      historyHarness.service.sendMessage(historyHarness.ownerUserId, {
        threadId: historyHarness.threadId,
        content: "History failure",
        idempotencyKey: "send-p203-history-failure",
        correlationId: "corr-p203-history-failure",
      }),
    /history store unavailable/i,
  );
  const historyAssistant = [...historyHarness.messages.values()].find((message) => message.role === "assistant");
  assert.equal(historyAssistant?.status, "failed");
  assert.match(historyAssistant?.errorMessage ?? "", /history store unavailable/i);
});
