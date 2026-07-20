export const heavyChatSlotKinds = ["default", "custom", "purchased"] as const;
export type HeavyChatSlotKind = (typeof heavyChatSlotKinds)[number];

export const heavyChatMessageRoles = ["user", "assistant", "system"] as const;
export type HeavyChatMessageRole = (typeof heavyChatMessageRoles)[number];

export const heavyChatMessageStatuses = ["pending", "streaming", "complete", "failed"] as const;
export type HeavyChatMessageStatus = (typeof heavyChatMessageStatuses)[number];

export const heavyChatReferenceTypes = ["file", "mail", "task", "delivery"] as const;
export type HeavyChatReferenceType = (typeof heavyChatReferenceTypes)[number];

export const heavyChatActionTypes = ["task", "mailbox"] as const;
export type HeavyChatActionType = (typeof heavyChatActionTypes)[number];

export const heavyChatActionStatuses = ["pending", "complete", "failed"] as const;
export type HeavyChatActionStatus = (typeof heavyChatActionStatuses)[number];

export type HeavyChatReference = {
  id: string;
  type: HeavyChatReferenceType;
  title: string;
  meta?: string | null;
  targetId?: string | null;
};

export type HeavyChatAction = {
  id: string;
  type: HeavyChatActionType;
  status: HeavyChatActionStatus;
  targetId?: string | null;
  errorMessage?: string | null;
};

export type HeavyChatSlotView = {
  id: string;
  ownerUserId: string;
  slotKey: string;
  kind: HeavyChatSlotKind;
  title: string;
  personaLabel: string | null;
  summary: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type HeavyChatSlotAgentBindingView = {
  id: string;
  ownerUserId: string;
  slotId: string;
  agentId: string;
  createdAt: string;
  updatedAt: string;
};

export type HeavyChatProjectView = {
  id: string;
  ownerUserId: string;
  title: string;
  subtitle: string | null;
  instructions: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type HeavyChatThreadView = {
  id: string;
  ownerUserId: string;
  slotId: string;
  projectId: string | null;
  title: string;
  favorite: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type HeavyChatMessageView = {
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
  createdAt: string;
  updatedAt: string;
};

export type HeavyChatMessageAttemptView = {
  id: string;
  ownerUserId: string;
  messageId: string;
  idempotencyKey: string;
  attemptNumber: number;
  createdAt: string;
};

export type HeavyChatSlotProjectView = {
  slotId: string;
  projectId: string;
};

export type HeavyChatSnapshot = {
  slots: HeavyChatSlotView[];
  projects: HeavyChatProjectView[];
  slotProjects: HeavyChatSlotProjectView[];
  bindings: HeavyChatSlotAgentBindingView[];
  threads: HeavyChatThreadView[];
  messages: HeavyChatMessageView[];
};

export type CreateHeavyChatThreadRequest = {
  slotId: string;
  projectId?: string | null;
  title: string;
};

export type SendHeavyChatMessageRequest = {
  content: string;
  idempotencyKey: string;
  correlationId?: string;
};

export type RetryHeavyChatMessageRequest = {
  idempotencyKey: string;
  correlationId?: string;
};

export type HeavyChatMessageAttemptResult = {
  assistantMessage: HeavyChatMessageView;
  attempt: HeavyChatMessageAttemptView;
  created: boolean;
};

export type HeavyChatSendMessageResult = HeavyChatMessageAttemptResult & {
  userMessage: HeavyChatMessageView;
};

export type CreateHeavyChatSlotInput = {
  slotKey?: string;
  title: string;
  personaLabel?: string | null;
  summary?: string | null;
  kind?: Exclude<HeavyChatSlotKind, "default">;
  maxSlots?: number;
  entitlement?: { maxSlots: number };
};

export type CreateHeavyChatProjectInput = {
  id?: string;
  title: string;
  subtitle?: string | null;
  instructions?: string | null;
  sortOrder?: number;
  createdAt?: string;
};

export type CreateHeavyChatThreadInput = {
  id?: string;
  slotId: string;
  projectId?: string | null;
  title: string;
  favorite?: boolean;
  sortOrder?: number;
  createdAt?: string;
};

export type AppendHeavyChatMessageInput = {
  id?: string;
  threadId: string;
  role: HeavyChatMessageRole;
  status?: HeavyChatMessageStatus;
  content?: string;
  references?: HeavyChatReference[];
  actions?: HeavyChatAction[];
  idempotencyKey?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
};

export type TransitionHeavyChatMessageInput = {
  status: HeavyChatMessageStatus;
  content?: string;
  references?: HeavyChatReference[];
  actions?: HeavyChatAction[];
  errorCode?: string | null;
  errorMessage?: string | null;
};
