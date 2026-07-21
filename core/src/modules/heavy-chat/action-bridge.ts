import type { HeavyChatAction, HeavyChatActionType } from "@neuro/contracts";

import type { HeavyChatRepository } from "./repository";
import {
  HeavyChatActionConflictError,
  HeavyChatInvalidTransitionError,
  HeavyChatOwnershipError,
} from "./types";

const DEFAULT_ACTION_RECOVERY_AFTER_MS = 5 * 60 * 1000;

export type HeavyChatActionTarget = {
  id: string;
  type: HeavyChatActionType;
  href: string;
};

export type HeavyChatActionResult = {
  action: HeavyChatAction;
  target: HeavyChatActionTarget | null;
  executed: boolean;
  created: boolean;
};

type ActionRepository = Pick<
  HeavyChatRepository,
  | "findMessageById"
  | "reserveMessageAction"
  | "completeMessageAction"
  | "failMessageAction"
>;

type TaskDraftInput = {
  idempotencyKey: string;
  title: string;
  description: string;
  preferredCapabilityCodes: string[];
};

type MailboxMessageInput = {
  userId: string;
  idempotencyKey: string;
  title: string;
  body: string;
  type: "system";
  folder: "stash";
  summary: string;
  sourceLabel: string;
};

export type HeavyChatActionBridgeOptions = {
  repository: ActionRepository;
  assertEnabled?: (type: HeavyChatActionType) => Promise<void> | void;
  taskHub: {
    createTaskDraft(
      ownerUserId: string,
      input: TaskDraftInput,
    ): Promise<{ task: { id: string }; created: boolean }>;
    getOwnedTaskSummary(ownerUserId: string, taskId: string): Promise<{ id: string } | null>;
  };
  mailbox: {
    createMailboxMessage(input: MailboxMessageInput): Promise<{ messageId: string; created: boolean }>;
    getMailboxMessageById(ownerUserId: string, messageId: string): Promise<{ id: string } | null>;
  };
  actionRecoveryAfterMs?: number;
  now?: () => Date;
};

function compactText(value: string, maximum: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, Math.max(0, maximum - 3))}...`;
}

function actionTarget(type: HeavyChatActionType, targetId: string): HeavyChatActionTarget {
  if (type === "task") {
    return {
      id: targetId,
      type,
      href: `/my-tasks#task-${encodeURIComponent(targetId)}`,
    };
  }
  return {
    id: targetId,
    type,
    href: `/mailbox?messageId=${encodeURIComponent(targetId)}`,
  };
}

function actionFailureMessage(type: HeavyChatActionType) {
  return type === "task"
    ? "Task draft action failed. Retry is safe."
    : "Mailbox draft action failed. Retry is safe.";
}

export class HeavyChatActionExecutionError extends Error {
  readonly actionType: HeavyChatActionType;
  readonly sourceError: unknown;

  constructor(type: HeavyChatActionType, sourceError: unknown) {
    super(actionFailureMessage(type));
    this.name = "HeavyChatActionExecutionError";
    this.actionType = type;
    this.sourceError = sourceError;
  }
}

function resolveRecoveryAfterMs(value: number | undefined) {
  const resolved = value ?? DEFAULT_ACTION_RECOVERY_AFTER_MS;
  if (!Number.isFinite(resolved) || resolved < 1) {
    throw new Error("Heavy chat action recovery threshold must be a positive finite number");
  }
  return Math.floor(resolved);
}

export function createHeavyChatActionBridge(options: HeavyChatActionBridgeOptions) {
  const now = options.now ?? (() => new Date());
  const recoveryAfterMs = resolveRecoveryAfterMs(options.actionRecoveryAfterMs);

  async function getTarget(ownerUserId: string, type: HeavyChatActionType, targetId: string) {
    return type === "task"
      ? options.taskHub.getOwnedTaskSummary(ownerUserId, targetId)
      : options.mailbox.getMailboxMessageById(ownerUserId, targetId);
  }

  return {
    async runAction(
      ownerUserId: string,
      input: { messageId: string; type: HeavyChatActionType },
    ): Promise<HeavyChatActionResult> {
      await options.assertEnabled?.(input.type);
      const message = await options.repository.findMessageById(ownerUserId, input.messageId);
      if (!message || message.ownerUserId !== ownerUserId) {
        throw new HeavyChatOwnershipError("Heavy chat message does not belong to the owner");
      }
      if (message.role !== "assistant" || message.status !== "complete") {
        throw new HeavyChatInvalidTransitionError(
          "Heavy chat actions require a completed assistant message",
        );
      }

      const reserved = await options.repository.reserveMessageAction(
        ownerUserId,
        message.id,
        input.type,
        { staleBefore: new Date(now().getTime() - recoveryAfterMs) },
      );
      if (!reserved.claimed) {
        return {
          action: reserved.action,
          target: reserved.action.status === "complete" && reserved.action.targetId
            ? actionTarget(input.type, reserved.action.targetId)
            : null,
          executed: false,
          created: false,
        };
      }

      let targetId = reserved.action.targetId;
      let targetCreated = false;
      try {
        let target = targetId ? await getTarget(ownerUserId, input.type, targetId) : null;
        if (!target) {
          if (input.type === "task") {
            const created = await options.taskHub.createTaskDraft(ownerUserId, {
              idempotencyKey: `heavy-chat:task-action:${reserved.action.id}`,
              title: compactText(message.content, 120) || "Heavy chat task draft",
              description: message.content,
              preferredCapabilityCodes: [],
            });
            targetId = created.task.id;
            targetCreated = created.created;
          } else {
            const titleText = compactText(message.content, 80) || "Heavy chat mailbox draft";
            const created = await options.mailbox.createMailboxMessage({
              userId: ownerUserId,
              idempotencyKey: `heavy-chat:mailbox-action:${reserved.action.id}`,
              title: `Heavy chat: ${titleText}`,
              body: message.content,
              type: "system",
              folder: "stash",
              summary: compactText(message.content, 120),
              sourceLabel: "Heavy Chat",
            });
            targetId = created.messageId;
            targetCreated = created.created;
          }
          target = await getTarget(ownerUserId, input.type, targetId);
        }
        if (!target) {
          throw new Error(
            input.type === "task"
              ? "Task Hub draft could not be queried after creation"
              : "Mailbox draft could not be queried after creation",
          );
        }

        const completed = await options.repository.completeMessageAction(
          ownerUserId,
          message.id,
          reserved.action.id,
          reserved.action.attemptNumber,
          target.id,
        );
        return {
          action: completed.action,
          target: actionTarget(input.type, target.id),
          executed: true,
          created: targetCreated,
        };
      } catch (error) {
        const executionError = new HeavyChatActionExecutionError(input.type, error);
        try {
          await options.repository.failMessageAction(
            ownerUserId,
            message.id,
            reserved.action.id,
            reserved.action.attemptNumber,
            {
              errorMessage: executionError.message,
              targetId,
            },
          );
        } catch (persistenceError) {
          if (!(persistenceError instanceof HeavyChatActionConflictError)) {
            throw new HeavyChatActionExecutionError(input.type, persistenceError);
          }
        }
        if (error instanceof HeavyChatActionConflictError) throw error;
        throw executionError;
      }
    },
  };
}
