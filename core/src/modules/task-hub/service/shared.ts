// Shared constants, view converters, pricing normalizers, and cross-cutting
// query helpers. Moved verbatim from service.ts.

import type {
  CreateTaskInput,
  ProductCurrency,
  TaskAgentProposalView,
  TaskApplicationView,
  TaskView,
} from "@neuro/contracts";
import { and, count, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { getEnabledCapabilityCodeMap } from "@/modules/agent-registry/service";
import {
  taskAgentProposals,
  taskApplications,
  tasks,
} from "@/modules/task-hub/schema";

export const TASK_REWARD_ESCROW_USER_ID = "platform:task_reward_escrow";
export const DEFAULT_TOKEN_BILLING_UNIT = "1k_tokens";
export const DEFAULT_TOKEN_METER_KEY = "llm_tokens";
export const DEFAULT_PROPERTY_BILLING_UNIT = "task_property";
export const DEFAULT_PROPERTY_METER_KEY = "task_units";

export function now() {
  return new Date();
}

export function normalizeCapabilityCodes(input: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  return (input ?? [])
    .map((code) => code.trim())
    .filter((code) => code.length > 0)
    .filter((code) => {
      if (seen.has(code)) return false;
      seen.add(code);
      return true;
    });
}

export function normalizeTaskPricingMode(
  input: CreateTaskInput["pricingMode"] | null | undefined,
): "flat_task" | "token_metered" | "property_metered" {
  if (input === "token_metered") return "token_metered";
  if (input === "property_metered") return "property_metered";
  return "flat_task";
}

export function normalizeTaskOperationMode(
  input: CreateTaskInput["operationMode"] | null | undefined,
): "manual" | "automatic" {
  return input === "automatic" ? "automatic" : "manual";
}

export function normalizeTaskBillingUnit(
  pricingMode: "flat_task" | "token_metered" | "property_metered",
  input: CreateTaskInput["billingUnit"] | null | undefined,
) {
  const trimmed = input?.trim() || null;
  if (pricingMode === "token_metered") {
    return trimmed ?? DEFAULT_TOKEN_BILLING_UNIT;
  }
  if (pricingMode === "property_metered") {
    return trimmed ?? DEFAULT_PROPERTY_BILLING_UNIT;
  }
  return trimmed;
}

export function normalizeTaskMeterKey(
  pricingMode: "flat_task" | "token_metered" | "property_metered",
  input: CreateTaskInput["meterKey"] | null | undefined,
) {
  const trimmed = input?.trim() || null;
  if (pricingMode === "token_metered") {
    return trimmed ?? DEFAULT_TOKEN_METER_KEY;
  }
  if (pricingMode === "property_metered") {
    return trimmed ?? DEFAULT_PROPERTY_METER_KEY;
  }
  return trimmed;
}

export function normalizeTaskMeterQuantity(
  pricingMode: "flat_task" | "token_metered" | "property_metered",
  input: CreateTaskInput["meterQuantity"] | null | undefined,
) {
  if (pricingMode === "flat_task") {
    return null;
  }
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return 1;
  }
  return Math.max(1, Math.floor(input));
}

export function toTaskView(task: typeof tasks.$inferSelect, applicationCount: number, arbitrationCaseCount = 0): TaskView {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    preferredCapabilityCodes: normalizeCapabilityCodes(task.preferredCapabilityCodes),
    pricingMode: task.pricingMode as TaskView["pricingMode"],
    billingUnit: task.billingUnit,
    meterKey: task.meterKey,
    meterQuantity: task.meterQuantity,
    operationMode: task.operationMode as TaskView["operationMode"],
    rewardCurrency: task.rewardCurrency as ProductCurrency,
    rewardAmount: task.rewardAmount,
    requiredBondAmount: task.requiredBondAmount,
    status: task.status as TaskView["status"],
    creatorUserId: task.creatorUserId,
    assignedUserId: task.assignedUserId,
    arbitrationCaseCount,
    applicationCount,
    createdAt: task.createdAt.toISOString(),
  };
}

export function toTaskApplicationView(application: typeof taskApplications.$inferSelect): TaskApplicationView {
  return {
    id: application.id,
    taskId: application.taskId,
    applicantUserId: application.applicantUserId,
    statement: application.statement,
    proposedEtaHours: application.proposedEtaHours,
    status: application.status as TaskApplicationView["status"],
    createdAt: application.createdAt.toISOString(),
  };
}

export function toTaskAgentProposalView(
  proposal: typeof taskAgentProposals.$inferSelect,
  task: typeof tasks.$inferSelect,
  viewerUserId: string,
  matchedCapabilityCodes: string[] = [],
): TaskAgentProposalView {
  return {
    id: proposal.id,
    taskId: proposal.taskId,
    proposerUserId: proposal.proposerUserId,
    agentId: proposal.agentId,
    statement: proposal.statement,
    proposedEtaHours: proposal.proposedEtaHours,
    proposedCostNote: proposal.proposedCostNote,
    status: proposal.status as TaskAgentProposalView["status"],
    executionId: proposal.executionId,
    matchedCapabilityCodes,
    matchedCapabilityCount: matchedCapabilityCodes.length,
    canAccept:
      proposal.status === "pending" &&
      task.creatorUserId === viewerUserId &&
      ["open", "applying"].includes(task.status),
    canReject:
      proposal.status === "pending" &&
      task.creatorUserId === viewerUserId &&
      ["open", "applying"].includes(task.status),
    createdAt: proposal.createdAt.toISOString(),
  };
}

export function getTaskMeterQuantity(task: typeof tasks.$inferSelect) {
  if (task.pricingMode === "token_metered" || task.pricingMode === "property_metered") {
    return Math.max(1, Number(task.meterQuantity ?? 1));
  }
  return null;
}

export async function getProposalMatchedCapabilityMap(
  task: typeof tasks.$inferSelect,
  proposals: typeof taskAgentProposals.$inferSelect[],
) {
  const preferredCodes = normalizeCapabilityCodes(task.preferredCapabilityCodes);
  if (proposals.length === 0 || preferredCodes.length === 0) {
    return new Map<string, string[]>();
  }

  const capabilityMap = await getEnabledCapabilityCodeMap(proposals.map((proposal) => proposal.agentId));
  return new Map(
    proposals.map((proposal) => [
      proposal.id,
      preferredCodes.filter((code) => (capabilityMap.get(proposal.agentId) ?? []).includes(code)),
    ]),
  );
}

export async function getTaskWithCountInTx(tx: NodePgDatabase<typeof schema>, taskId: string) {
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return null;
  const [applicationCountRows, arbitrationCountRows] = await Promise.all([
    tx
      .select({ count: count(taskApplications.id) })
      .from(taskApplications)
      .where(eq(taskApplications.taskId, taskId)),
    tx
      .select({ count: count(schema.arbitrationCases.id) })
      .from(schema.arbitrationCases)
      .where(and(eq(schema.arbitrationCases.entityType, "task"), eq(schema.arbitrationCases.entityId, taskId))),
  ]);
  const applicationCountRow = applicationCountRows[0];
  const arbitrationCountRow = arbitrationCountRows[0];
  return {
    task,
    applicationCount: Number(applicationCountRow?.count ?? 0),
    arbitrationCaseCount: Number(arbitrationCountRow?.count ?? 0),
  };
}

export function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}
