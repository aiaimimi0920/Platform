import {
  type AppendHeavyChatMessageArgs,
  type CreateHeavyChatProjectArgs,
  type CreateHeavyChatThreadArgs,
  type HeavyChatRepository,
} from "./repository";
import {
  HeavyChatManagedAgentValidationError,
  HeavyChatOwnershipError,
  type HeavyChatMessageAttemptRecord,
  type HeavyChatMessageRecord,
  type HeavyChatSlotAgentBindingRecord,
  type HeavyChatSlotRecord,
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
};

function requirePositiveMaxSlots(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Heavy chat slot entitlement must be a positive integer");
  }
  return value;
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

  return {
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

    validateManagedHeavyAgent,
  };
}

export { validateManagedHeavyAgent };
