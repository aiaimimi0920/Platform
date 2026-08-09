import type {
  HeavyChatAction,
  HeavyChatMessageRole,
  HeavyChatMessageStatus,
  HeavyChatReference,
  HeavyChatSlotKind,
} from "@neuro/contracts";

export type HeavyChatSlotRecord = {
  id: string;
  ownerUserId: string;
  slotKey: string;
  kind: HeavyChatSlotKind;
  title: string;
  personaLabel: string | null;
  summary: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type HeavyChatProjectRecord = {
  id: string;
  ownerUserId: string;
  title: string;
  subtitle: string | null;
  instructions: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type HeavyChatSlotProjectRecord = {
  id: string;
  ownerUserId: string;
  slotId: string;
  projectId: string;
  createdAt: Date;
};

export type HeavyChatSlotAgentBindingRecord = {
  id: string;
  ownerUserId: string;
  slotId: string;
  agentId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type HeavyChatThreadRecord = {
  id: string;
  ownerUserId: string;
  slotId: string;
  projectId: string | null;
  title: string;
  favorite: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type HeavyChatMessageRecord = {
  id: string;
  ownerUserId: string;
  threadId: string;
  role: HeavyChatMessageRole;
  status: HeavyChatMessageStatus;
  sequence: number;
  attemptNumber: number;
  content: string;
  references: HeavyChatReference[];
  actions: HeavyChatAction[];
  idempotencyKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type HeavyChatGatewayHistoryMessageRecord = Pick<HeavyChatMessageRecord, "role" | "content">;

export type HeavyChatMessagePageRecord = {
  threadId: string;
  messages: HeavyChatMessageRecord[];
  hasMore: boolean;
  nextBeforeSequence: number | null;
};

export type HeavyChatMessageAttemptRecord = {
  id: string;
  ownerUserId: string;
  messageId: string;
  idempotencyKey: string;
  attemptNumber: number;
  createdAt: Date;
};

export const HEAVY_CHAT_DEFAULT_SLOT_KEY = "mimi";
export const HEAVY_CHAT_DEFAULT_SLOT_TITLE = "觅觅";
export const HEAVY_CHAT_DEFAULT_MAX_SLOTS = 2;

export class HeavyChatOwnershipError extends Error {
  override name = "HeavyChatOwnershipError";
}

export class HeavyChatSlotLimitError extends Error {
  override name = "HeavyChatSlotLimitError";
}

export class HeavyChatAgentBindingConflictError extends Error {
  override name = "HeavyChatAgentBindingConflictError";
}

export class HeavyChatAttemptConflictError extends Error {
  override name = "HeavyChatAttemptConflictError";
}

export class HeavyChatActionConflictError extends Error {
  override name = "HeavyChatActionConflictError";
}

export class HeavyChatManagedAgentValidationError extends Error {
  override name = "HeavyChatManagedAgentValidationError";
}

export class HeavyChatInvalidTransitionError extends Error {
  override name = "HeavyChatInvalidTransitionError";
}

export function canTransitionHeavyChatMessageStatus(
  current: HeavyChatMessageStatus,
  next: HeavyChatMessageStatus,
): boolean {
  if (current === next) return true;
  if (current === "pending") return next === "streaming" || next === "complete" || next === "failed";
  if (current === "streaming") return next === "complete" || next === "failed";
  if (current === "failed") return next === "pending" || next === "streaming";
  return false;
}
