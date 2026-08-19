import type {
  AgentMarketplaceBillingMode,
  AgentExecutionCallbackAuditStatus,
  AgentExecutionCallbackAutoRemediationReasonCategory,
  AgentExecutionCallbackAutoRemediationReasonDisposition,
  AgentCallbackRemediationPolicyKey,
  AgentExecutionCallbackRemediationDecisionClass,
  AgentExecutionCallbackReplayFailureClass,
  AgentExecutionCallbackRejectionCategory,
  AgentExecutionCallbackType,
  AgentExecutionCallbackRetryability,
  AgentExecutionRuntimeDecisionClass,
  AgentExecutionRuntimeDecisionSeverity,
  AgentExecutionRuntimePressureLevel,
  AgentExecutionRecentWindowKey,
  AgentExecutionRuntimeSchedulingDecisionClass,
  AgentExecutionStoredReplayPayloadCompatibility,
  AgentExecutionRunFailureCategory,
  AgentExecutionSubtaskStatus,
  AgentExecutionRunView,
  AgentExecutionRunStatus,
  AgentExecutionStatus,
  AgentSourceType,
  PlatformExecutionPhase,
  ProductCurrency,
} from "@neuro/contracts";
import { and, type SQL } from "drizzle-orm";

import { redis } from "@/db/redis";
import {
  buildAgentCallbackRemediationPolicyView,
} from "@/modules/agent-registry/service";

export const transitionMap: Record<AgentExecutionStatus, AgentExecutionStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["submitted", "completed", "failed", "cancelled"],
  submitted: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export const subtaskTransitionMap: Record<AgentExecutionSubtaskStatus, AgentExecutionSubtaskStatus[]> = {
  pending: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export const terminalExecutionStatuses = new Set<AgentExecutionStatus>(["completed", "failed", "cancelled"]);

export const externalCallbackPendingTtlSeconds = 5 * 60;
export const externalCallbackProcessedTtlSeconds = 24 * 60 * 60;
export const platformRuntimeLoopLockKey = "agent-execution:platform-runtime-loop";
export const platformRuntimeLoopLockTtlSeconds = 30;
export const automaticCallbackRemediationActorId = "system:callback-auto-remediation";
export const callbackRemediationAlertEventName = "agentExecution.callbackRemediationAlerted";
export const runtimePressureAlertEventName = "agentExecution.runtimePressureAlerted";

export const runtimeSubtaskPhaseOrder: Array<PlatformExecutionPhase | null> = ["prepare", "produce_artifact", "finalize", null, null];
export const managedApiDispatchTimeoutMs = 90_000;
export const externalRuntimeDispatchTimeoutMs = 30_000;
export const accountInternalUrl = process.env.ACCOUNT_INTERNAL_URL?.trim() || process.env.ACCOUNT_API_INTERNAL_URL?.trim() || null;

export type StoredMarketplaceInvocationSnapshot = {
  listingId: string;
  supplierUserId: string;
  capabilityId: string;
  capabilityCode: string;
  capabilityTitle: string;
  publicTitle: string;
  billingMode: AgentMarketplaceBillingMode;
  billingUnit: string | null;
  meterKey: string | null;
  meterQuantity: number;
  priceCurrency: ProductCurrency;
  unitPriceAmount: number;
  quotedAmount: number;
  invokedAt: string;
};

export type RuntimeDispatchResult = {
  state: "queued" | "running" | "completed" | "failed" | "cancelled";
  message: string | null;
  executionId: string;
};

export type CallbackAuditOperatorQuery = {
  agentId?: string;
  callbackType?: AgentExecutionCallbackType;
  status?: AgentExecutionCallbackAuditStatus;
  remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
  callbackVersion?: number;
  secretVersion?: number;
  protocolMatch?: "current" | "previous";
  secretMatch?: "current" | "previous";
  rejectionCategory?: AgentExecutionCallbackRejectionCategory;
  retryability?: AgentExecutionCallbackRetryability;
  autoRemediationReasonCategory?: AgentExecutionCallbackAutoRemediationReasonCategory;
  autoRemediationReasonDisposition?: AgentExecutionCallbackAutoRemediationReasonDisposition;
  replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility;
  replayPayloadReplayable?: boolean;
  decisionClass?: AgentExecutionCallbackRemediationDecisionClass;
  replayFailureClass?: AgentExecutionCallbackReplayFailureClass;
  runtimeDecisionClass?: AgentExecutionRuntimeDecisionClass;
  runtimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity;
  runtimePressureLevel?: AgentExecutionRuntimePressureLevel;
  runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
  limit?: number;
};

export type ExecutionRunOperatorQuery = {
  agentId?: string;
  ownerUserId?: string;
  executionIds?: string[];
  runIds?: string[];
  runKind?: AgentExecutionRunView["runKind"];
  runStatus?: AgentExecutionRunStatus;
  executionStatus?: AgentExecutionStatus;
  failureCategory?: AgentExecutionRunFailureCategory;
  recentWindow?: AgentExecutionRecentWindowKey;
  limit?: number;
};

export type CallbackRemediationSummaryQuery = {
  agentId?: string;
  callbackType?: AgentExecutionCallbackType;
  remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
  autoRemediationReasonCategory?: AgentExecutionCallbackAutoRemediationReasonCategory;
  autoRemediationReasonDisposition?: AgentExecutionCallbackAutoRemediationReasonDisposition;
  replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility;
  replayPayloadReplayable?: boolean;
  decisionClass?: AgentExecutionCallbackRemediationDecisionClass;
  replayFailureClass?: AgentExecutionCallbackReplayFailureClass;
  runtimeDecisionClass?: AgentExecutionRuntimeDecisionClass;
  runtimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity;
  runtimePressureLevel?: AgentExecutionRuntimePressureLevel;
  runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
};

export type CallbackRemediationAlertEmitQuery = CallbackRemediationSummaryQuery & {
  limit?: number;
  minimumAlertLevel?: number;
};

export type RuntimePressureAlertSummaryQuery = {
  pressureLevel?: AgentExecutionRuntimePressureLevel;
  schedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
};

export type RuntimePressureAlertEmitQuery = RuntimePressureAlertSummaryQuery & {
  limit?: number;
  minimumAlertLevel?: number;
};

export type ExecutionCallbackRemediationPolicyMetadata = {
  agentSourceType: AgentSourceType;
  key: AgentCallbackRemediationPolicyKey;
  source: "agent" | "execution";
  overrideKey: AgentCallbackRemediationPolicyKey | null;
  policy: ReturnType<typeof buildAgentCallbackRemediationPolicyView>;
};

export function now() {
  return new Date();
}

export async function acquireEphemeralLock(lockKey: string, ttlSeconds: number) {
  const token = crypto.randomUUID();
  const claimed = await redis.set(lockKey, token, "EX", ttlSeconds, "NX");
  return claimed === "OK" ? token : null;
}

export async function releaseEphemeralLock(lockKey: string, token: string) {
  await redis.eval(
    `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `,
    1,
    lockKey,
    token,
  );
}

export async function renewEphemeralLock(lockKey: string, token: string, ttlSeconds: number) {
  const renewed = await redis.eval(
    `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      end
      return 0
    `,
    1,
    lockKey,
    token,
    ttlSeconds,
  );
  return Number(renewed) === 1;
}

export function startEphemeralLockRenewal(lockKey: string, token: string, ttlSeconds: number) {
  const interval = setInterval(() => {
    void renewEphemeralLock(lockKey, token, ttlSeconds).catch(() => undefined);
  }, Math.max(1_000, Math.floor((ttlSeconds * 1_000) / 3)));
  interval.unref();
  return () => clearInterval(interval);
}

export function toWhereClause(conditions: SQL[]) {
  return conditions.length > 0 ? and(...conditions) : undefined;
}
