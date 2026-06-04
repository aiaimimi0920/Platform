import type { ReputationUpdatedEventPayload } from "@neuro/contracts";

export const reputationEventNames = ["reputation.updated"] as const;

export function buildTaskLifecycleReputationUpdatedPayload(args: {
  action: ReputationUpdatedEventPayload["action"];
  taskId: string;
  actorUserId: string;
  creatorUserId: string;
  assignedUserId: string;
  arbitrationCaseId?: string | null;
}): ReputationUpdatedEventPayload {
  return {
    trigger: "task_lifecycle",
    action: args.action,
    taskId: args.taskId,
    actorUserId: args.actorUserId,
    userIds: Array.from(new Set([args.creatorUserId, args.assignedUserId].map((userId) => userId.trim()).filter(Boolean))),
    arbitrationCaseId: args.arbitrationCaseId ?? null,
  };
}
