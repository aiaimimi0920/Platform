import {
  type AppendHeavyChatMessageArgs,
  type CreateHeavyChatProjectArgs,
  type CreateHeavyChatThreadArgs,
  type HeavyChatRepository,
} from "./repository";
import {
  HeavyChatAttemptConflictError,
  HeavyChatManagedAgentValidationError,
  HeavyChatOwnershipError,
  type HeavyChatMessageAttemptRecord,
  type HeavyChatMessageRecord,
  type HeavyChatSlotAgentBindingRecord,
  type HeavyChatSlotRecord,
  type HeavyChatProjectRecord,
  type HeavyChatSlotProjectRecord,
  type HeavyChatThreadRecord,
} from "./types";
import { validateManagedHeavyAgentInput } from "../agent-registry/managed-heavy-validation";
import { HttpError } from "../../platform/errors";

export type ManagedHeavyAgentResolution = {
  id: string;
  ownerUserId: string;
  sourceType: string;
  hostingMode: string;
  runtimeEndpoint?: string | null;
  runtimeAuthToken?: string | null;
  authMode?: string | null;
  managedServiceId?: string | null;
  managedProviderLabel?: string | null;
  managedApiBaseUrl?: string | null;
  managedModel?: string | null;
  managedApiKey?: string | null;
  managedSystemPrompt?: string | null;
  managedPromptTemplate?: string | null;
  managedTaskCategory?: string | null;
  managedCapabilitySummary?: string | null;
};

export type HeavyChatServiceOptions = {
  repository: HeavyChatRepository;
  resolveMaxSlots?: (ownerUserId: string) => Promise<number> | number;
  resolveManagedHeavyAgent: (
    ownerUserId: string,
    agentId: string,
  ) => Promise<ManagedHeavyAgentResolution | null>;
  gatewayClient?: HeavyChatGatewayClient;
  gatewayModel?: string;
  attemptRecoveryAfterMs?: number;
  now?: () => Date;
};

export type HeavyChatGatewayRequestMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type HeavyChatGatewayCompletionRequest = {
  ownerUserId: string;
  model: string;
  messages: HeavyChatGatewayRequestMessage[];
  requestId: string;
  correlationId: string;
  stream?: boolean;
  onChunk?: (delta: string) => Promise<void> | void;
};

export type HeavyChatGatewayCompletionResponse = {
  content: string;
  requestId: string;
  statusCode: number;
  finishReason: string | null;
};

export type HeavyChatGatewayClient = {
  complete(input: HeavyChatGatewayCompletionRequest): Promise<HeavyChatGatewayCompletionResponse>;
};

export type HeavyChatSendMessageInput = {
  threadId: string;
  content: string;
  idempotencyKey: string;
  correlationId: string;
};

export type HeavyChatRetryMessageInput = {
  messageId: string;
  idempotencyKey: string;
  correlationId: string;
};

export type HeavyChatExecutionResult = {
  assistantMessage: HeavyChatMessageRecord;
  attempt: HeavyChatMessageAttemptRecord;
  created: boolean;
};

export type HeavyChatSendMessageResult = HeavyChatExecutionResult & {
  userMessage: HeavyChatMessageRecord;
};

export type HeavyChatSnapshotRecord = {
  slots: HeavyChatSlotRecord[];
  projects: HeavyChatProjectRecord[];
  slotProjects: Array<Pick<HeavyChatSlotProjectRecord, "slotId" | "projectId">>;
  bindings: HeavyChatSlotAgentBindingRecord[];
  threads: HeavyChatThreadRecord[];
  messages: HeavyChatMessageRecord[];
};

const DEFAULT_ATTEMPT_RECOVERY_AFTER_MS = 5 * 60 * 1000;

function requirePositiveMaxSlots(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Heavy chat slot entitlement must be a positive integer");
  }
  return value;
}

function requireIdempotencyKey(value: string) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    throw new Error("Heavy chat idempotency key is required");
  }
  return normalized;
}

function resolveAttemptRecoveryAfterMs(value: number | undefined) {
  const resolved = value ?? DEFAULT_ATTEMPT_RECOVERY_AFTER_MS;
  if (!Number.isFinite(resolved) || resolved < 1) {
    throw new Error("Heavy chat attempt recovery threshold must be a positive finite number");
  }
  return Math.floor(resolved);
}

function requireGatewayClient(options: HeavyChatServiceOptions) {
  if (!options.gatewayClient) {
    throw new Error("Heavy chat Gateway client is not configured");
  }
  const model = options.gatewayModel?.trim();
  if (!model) {
    throw new Error("Heavy chat Gateway model is not configured");
  }
  return { client: options.gatewayClient, model };
}

function readGatewayErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code.trim();
  }
  return "gateway_unavailable";
}

function readGatewayErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Heavy chat Gateway request failed";
  return message.trim().slice(0, 1_000) || "Heavy chat Gateway request failed";
}

function assertMessageReplay(
  message: HeavyChatMessageRecord,
  expected: { ownerUserId: string; threadId: string; role: HeavyChatMessageRecord["role"]; content?: string },
) {
  if (
    message.ownerUserId !== expected.ownerUserId ||
    message.threadId !== expected.threadId ||
    message.role !== expected.role ||
    (expected.content !== undefined && message.content !== expected.content)
  ) {
    throw new HeavyChatAttemptConflictError("Heavy chat idempotency key is already used for another message");
  }
}

function buildGatewayHistory(messages: HeavyChatMessageRecord[], beforeSequence: number) {
  return messages
    .filter(
      (message) =>
        message.sequence < beforeSequence &&
        (message.role === "user" || message.role === "assistant" || message.role === "system") &&
        message.status === "complete" &&
        message.content.trim(),
    )
    .map((message) => ({ role: message.role, content: message.content }));
}

function validateManagedHeavyAgent(
  ownerUserId: string,
  agent: ManagedHeavyAgentResolution | null,
) {
  if (!agent || agent.ownerUserId !== ownerUserId) {
    throw new HeavyChatOwnershipError("Heavy chat agent does not belong to the owner");
  }
  if (agent.sourceType !== "platform" || agent.hostingMode !== "managed_heavy") {
    throw new HeavyChatManagedAgentValidationError(
      "Heavy chat requires a platform-owned managed_heavy agent; external runtime or managed-light agents are not allowed",
    );
  }
  try {
    validateManagedHeavyAgentInput(agent);
  } catch (error) {
    if (error instanceof HttpError) {
      throw new HeavyChatManagedAgentValidationError(
        `${error.message}; external runtime or managed-light fields are rejected`,
      );
    }
    throw error;
  }
  return agent;
}

export function createHeavyChatService(options: HeavyChatServiceOptions) {
  const repository = options.repository;
  const resolveMaxSlots = options.resolveMaxSlots ?? (() => 2);
  const now = options.now ?? (() => new Date());
  const attemptRecoveryAfterMs = resolveAttemptRecoveryAfterMs(options.attemptRecoveryAfterMs);

  function staleAttemptCutoff() {
    return new Date(now().getTime() - attemptRecoveryAfterMs);
  }

  async function executeAssistantAttempt(
    ownerUserId: string,
    threadId: string,
    attempt: {
      attempt: HeavyChatMessageAttemptRecord;
      message: HeavyChatMessageRecord;
      created: boolean;
    },
    correlationId: string,
  ): Promise<HeavyChatExecutionResult> {
    let streamedContent = "";
    const transitionAttempt = async (
      status: "streaming" | "complete" | "failed",
      patch: { content?: string; errorCode?: string | null; errorMessage?: string | null },
    ) => {
      const latest = await repository.findMessageById(ownerUserId, attempt.message.id);
      if (!latest || latest.attemptNumber !== attempt.attempt.attemptNumber) {
        throw new HeavyChatAttemptConflictError("Heavy chat message attempt changed before transition");
      }
      return repository.transitionMessage(ownerUserId, attempt.message.id, status, {
        ...patch,
        expectedAttemptNumber: attempt.attempt.attemptNumber,
      });
    };

    try {
      const { client, model } = requireGatewayClient(options);
      const history = buildGatewayHistory(
        await repository.listMessages(ownerUserId, threadId),
        attempt.message.sequence,
      );
      const response = await client.complete({
        ownerUserId,
        model,
        messages: history,
        requestId: attempt.attempt.id,
        correlationId,
        stream: true,
        onChunk: async (delta) => {
          if (!delta) return;
          streamedContent += delta;
          await transitionAttempt("streaming", { content: streamedContent });
        },
      });
      const finalContent = response.content || streamedContent;
      const completed = await transitionAttempt("complete", {
        content: finalContent,
        errorCode: null,
        errorMessage: null,
      });
      return {
        assistantMessage: completed,
        attempt: attempt.attempt,
        created: true,
      };
    } catch (error) {
      if (error instanceof HeavyChatAttemptConflictError) throw error;
      try {
        await transitionAttempt("failed", {
          errorCode: readGatewayErrorCode(error),
          errorMessage: readGatewayErrorMessage(error),
        });
      } catch (transitionError) {
        if (!(transitionError instanceof HeavyChatAttemptConflictError)) throw transitionError;
      }
      throw error;
    }
  }

  return {
    async getSnapshot(ownerUserId: string): Promise<HeavyChatSnapshotRecord> {
      await repository.createOrGetDefaultSlot(ownerUserId);
      const [slots, projects, threads] = await Promise.all([
        repository.listSlots(ownerUserId),
        repository.listProjects(ownerUserId),
        repository.listThreads(ownerUserId),
      ]);

      const [bindings, slotProjects, messagesByThread] = await Promise.all([
        Promise.all(slots.map((slot) => repository.findAgentBindingForSlot(ownerUserId, slot.id))),
        Promise.all(
          slots.map((slot) =>
            repository.listProjectsForSlot(ownerUserId, slot.id).then((boundProjects) =>
              boundProjects.map((project) => ({ slotId: slot.id, projectId: project.id })),
            ),
          ),
        ),
        Promise.all(threads.map((thread) => repository.listMessages(ownerUserId, thread.id))),
      ]);

      return {
        slots,
        projects,
        slotProjects: slotProjects.flat(),
        bindings: bindings.filter((binding): binding is HeavyChatSlotAgentBindingRecord => binding !== null),
        threads,
        messages: messagesByThread.flat(),
      };
    },

    async listSlots(ownerUserId: string) {
      return repository.listSlots(ownerUserId);
    },

    async listProjects(ownerUserId: string) {
      return repository.listProjects(ownerUserId);
    },

    async listThreads(ownerUserId: string) {
      return repository.listThreads(ownerUserId);
    },

    async listMessages(ownerUserId: string, threadId: string) {
      return repository.listMessages(ownerUserId, threadId);
    },

    async ensureDefaultSlot(ownerUserId: string): Promise<HeavyChatSlotRecord> {
      return repository.createOrGetDefaultSlot(ownerUserId);
    },

    async createCustomSlot(ownerUserId: string, input: { title: string; slotKey?: string }) {
      const maxSlots = requirePositiveMaxSlots(await resolveMaxSlots(ownerUserId));
      return repository.createCustomSlot(ownerUserId, { ...input, maxSlots });
    },

    async createProject(ownerUserId: string, input: CreateHeavyChatProjectArgs) {
      return repository.createProject(ownerUserId, input);
    },

    async bindProjectToSlot(ownerUserId: string, slotId: string, projectId: string) {
      return repository.bindProjectToSlot(ownerUserId, slotId, projectId);
    },

    async createThread(ownerUserId: string, input: CreateHeavyChatThreadArgs) {
      return repository.createThread(ownerUserId, input);
    },

    async appendMessage(ownerUserId: string, input: AppendHeavyChatMessageArgs) {
      return repository.appendMessage(ownerUserId, input);
    },

    async reserveMessageAttempt(
      ownerUserId: string,
      messageId: string,
      idempotencyKey: string,
    ): Promise<{
      attempt: HeavyChatMessageAttemptRecord;
      message: HeavyChatMessageRecord;
      created: boolean;
    }> {
      return repository.reserveMessageAttempt(ownerUserId, messageId, idempotencyKey);
    },

    async bindManagedAgent(
      ownerUserId: string,
      slotId: string,
      agentId: string,
    ): Promise<HeavyChatSlotAgentBindingRecord> {
      const agent = await options.resolveManagedHeavyAgent(ownerUserId, agentId);
      if (!agent || agent.id !== agentId) {
        throw new HeavyChatOwnershipError("Heavy chat agent resolution did not match the requested agent");
      }
      const validatedAgent = validateManagedHeavyAgent(ownerUserId, agent);
      return repository.bindAgentToSlot(ownerUserId, slotId, validatedAgent.id);
    },

    async sendMessage(ownerUserId: string, input: HeavyChatSendMessageInput): Promise<HeavyChatSendMessageResult> {
      const normalizedIdempotencyKey = requireIdempotencyKey(input.idempotencyKey);
      const thread = await repository.findThreadById(ownerUserId, input.threadId);
      if (!thread) throw new HeavyChatOwnershipError("Heavy chat thread does not belong to the owner");
      const binding = await repository.findAgentBindingForSlot(ownerUserId, thread.slotId);
      if (!binding) throw new HeavyChatOwnershipError("Heavy chat slot has no managed agent binding");
      const resolvedAgent = await options.resolveManagedHeavyAgent(ownerUserId, binding.agentId);
      if (!resolvedAgent || resolvedAgent.id !== binding.agentId) {
        throw new HeavyChatOwnershipError("Heavy chat agent resolution did not match the bound agent");
      }
      validateManagedHeavyAgent(ownerUserId, resolvedAgent);

      const userIdempotencyKey = `heavy-chat:user:${normalizedIdempotencyKey}`;
      const userMessage = await repository.appendMessage(ownerUserId, {
        threadId: thread.id,
        role: "user",
        status: "complete",
        content: input.content,
        idempotencyKey: userIdempotencyKey,
      });
      assertMessageReplay(userMessage, {
        ownerUserId,
        threadId: thread.id,
        role: "user",
        content: input.content,
      });

      const assistantMessage = await repository.appendMessage(ownerUserId, {
        threadId: thread.id,
        role: "assistant",
        status: "pending",
        content: "",
        idempotencyKey: `heavy-chat:assistant:${userMessage.id}`,
      });
      assertMessageReplay(assistantMessage, {
        ownerUserId,
        threadId: thread.id,
        role: "assistant",
      });

      const attempt = await repository.reserveMessageAttempt(
        ownerUserId,
        assistantMessage.id,
        `heavy-chat:attempt:${assistantMessage.id}:${normalizedIdempotencyKey}`,
        { staleBefore: staleAttemptCutoff() },
      );
      if (!attempt.created) {
        return {
          userMessage,
          assistantMessage: attempt.message,
          attempt: attempt.attempt,
          created: false,
        };
      }

      const result = await executeAssistantAttempt(ownerUserId, thread.id, attempt, input.correlationId);
      return { ...result, userMessage };
    },

    async retryMessage(ownerUserId: string, input: HeavyChatRetryMessageInput): Promise<HeavyChatExecutionResult> {
      const normalizedIdempotencyKey = requireIdempotencyKey(input.idempotencyKey);
      const message = await repository.findMessageById(ownerUserId, input.messageId);
      if (!message || message.role !== "assistant") {
        throw new HeavyChatOwnershipError("Heavy chat assistant message does not belong to the owner");
      }
      const thread = await repository.findThreadById(ownerUserId, message.threadId);
      if (!thread) throw new HeavyChatOwnershipError("Heavy chat thread does not belong to the owner");
      const binding = await repository.findAgentBindingForSlot(ownerUserId, thread.slotId);
      if (!binding) throw new HeavyChatOwnershipError("Heavy chat slot has no managed agent binding");
      const resolvedAgent = await options.resolveManagedHeavyAgent(ownerUserId, binding.agentId);
      if (!resolvedAgent || resolvedAgent.id !== binding.agentId) {
        throw new HeavyChatOwnershipError("Heavy chat agent resolution did not match the bound agent");
      }
      validateManagedHeavyAgent(ownerUserId, resolvedAgent);

      const attempt = await repository.reserveMessageAttempt(
        ownerUserId,
        message.id,
        normalizedIdempotencyKey,
        { staleBefore: staleAttemptCutoff() },
      );
      if (!attempt.created) {
        return {
          assistantMessage: attempt.message,
          attempt: attempt.attempt,
          created: false,
        };
      }
      return executeAssistantAttempt(ownerUserId, thread.id, attempt, input.correlationId);
    },

    validateManagedHeavyAgent,
  };
}

export { validateManagedHeavyAgent };
