import assert from "node:assert/strict";
import test from "node:test";

import type { HeavyChatRepository } from "./repository";
import { createHeavyChatService } from "./service";
import {
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
